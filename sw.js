/* 清掃報告書ツール：オフラインで使うための保管係（サービスワーカー）

   ねらい：電波の無い建物でも、入力・写真・PDF作成・端末への保存まで通せるようにする。
   気をつけたこと：この仕組みは作り方を誤ると「古い画面のまま更新されない」という
   厄介な副作用が出る。そこで画面本体は必ず先にインターネットを見に行き、
   取れなかった時だけ保管してあるものを使う（ネットワーク優先）。
   部品や画像は中身が変わらないので、保管してあるものを先に使う（キャッシュ優先）。

   まとめツール(/matome/)は対象外。PCで使うものであり、
   別の部品を読み込むため、中途半端に保管すると壊れて見えるため。 */
const CACHE = 'must-report-v1';
const ASSETS = [
  './', './manifest.webmanifest',        // 画面本体は './' 1つだけ。二重に持つと片方が古いまま残る
  './icon.svg', './icon-180.png', './icon-192.png', './icon-512.png', './favicon-32.png',
  './lib/html2canvas.min.js', './lib/jspdf.umd.min.js'
];

self.addEventListener('install', e=>{
  e.waitUntil(
    caches.open(CACHE)
      .then(c=>Promise.allSettled(ASSETS.map(u=>c.add(u))))   // 1つ失敗しても他は保管する
      .then(()=>self.skipWaiting())                            // 新しい版をすぐ有効にする
  );
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys()
      .then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))  // 古い保管を捨てる
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;      // 外部への通信は素通し
  if(url.pathname.includes('/matome/')) return;        // まとめツールは対象外

  // 画面本体と物件マスタ＝ネットワーク優先（更新をすぐ反映し、圏外では保管版を使う）
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('index.html');
  const isMaster = url.pathname.endsWith('.json') && !url.pathname.endsWith('manifest.webmanifest');
  // 複製は「本体を返す前」に作ること。あとから clone() しようとすると
  // 中身がすでに読まれていて保管に失敗する（＝圏外のとき古い版が出てしまう）
  const keep = (request, res)=>{
    if(!res || !res.ok || (res.type!=='basic' && res.type!=='default')) return res;
    const copy = res.clone();
    e.waitUntil(caches.open(CACHE).then(c=>c.put(request, copy)));
    return res;
  };

  if(isPage || isMaster){
    e.respondWith(
      fetch(req).then(res=>keep(req,res))                       // 取れた最新を保管し直す
        .catch(()=>caches.match(req).then(r=>r || caches.match('./')))
    );
    return;
  }

  // 部品・画像＝保管優先（中身が変わらないので速い方でよい）
  e.respondWith(
    caches.match(req).then(hit=> hit || fetch(req).then(res=>keep(req,res)))
  );
});
