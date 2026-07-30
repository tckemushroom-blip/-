跳至內容
新聊天
代理人
空格
火花
預覽

建立3D模型的線上作品集
副駕駛聊天
建立3D模型的線上作品集
我要在github內建立一個網站，導入3D模型“me.glb”，我希望該網站可以為捲動式的，而隨著網頁卷動，3d模型也轉到不同角度，該3D模型是我的q版模型，另外，卷動畫面中要包含壹一些適合放在作品集中的可以放文字、圖片的塊，我希望把這個網站構建成我的特色
好 — 我會為你創建一個可直接放到 GitHub（並以 GitHub Pages 發布）的作品集網站範本，包含：

一個載入assets/me.glb的三個.js場景（請自行把你的me.glb放入assets/資料夾）。
隨頁面捲動控制3D模型旋轉（平滑內插）。
多個集合區塊（文字、圖片版面作品示範），可直接替換成你的內容。
完整的部署與本地測試說明（包含上傳到GitHub、啟用頁面的步驟）。
我先把所有需要的內容檔案上線（你可以直接複製到本機檔案或倉庫），然後說明如何上傳並啟用GitHub Pages。下面是文件：

index.html
<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>我的線上作品集</title>
styles.css
:root{
  --bg:#0f1115;
  --panel:#0b0c0f;
  --text:#e6e6e6;
  --muted:#9aa0a6;
  --accent:#7bd389;
script.js
// script.js (module)
import * as THREE from 'https://unpkg.com/three@0.154.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.154.0/examples/jsm/loaders/GLTFLoader.js';

const container = document.getElementById('scene');

README.md
# 我的線上作品集（包含 3D 模型與捲動互動）

這是一個範例靜態網站，使用 Three.js 載入 `assets/me.glb`，並以頁面捲動控制模型旋轉。你可以把這個 repository 部署到 GitHub Pages 作為你的特色線上作品集。

快速步驟
1. 建立 repo（GitHub 網頁或 CLI）。
其他小提醒（摘要）

把你的me.glb放到assets/下（或更新script.js的路徑）。
如果你想用 GitHub UI 上傳：進入 repo → 新增檔案 → 上傳文件，一批以上文件並提交。
啟用頁面：設定→頁面→分支: main / root，儲存後等待1-5分鐘即可。
我已經把整個網站範本（HTML、CSS、JS、README）準備好。下一步由你決定：

如果你希望我替你直接把這些文件commit到某個GitHub倉庫，請告訴我該repo（owner/name），並確認該repo已存在且你允許我寫入；我可以幫你把文件上傳並說明如何授權頁面。
或者你要我先把範例改成「手機優先」「模型在左邊、內容在右邊」或是要加入「點擊切換不同姿勢的按鈕」等互動，我先可以修改程式碼再給你新的檔案。你怎麼進行？
有什麼想問的都可以問，或是輸入@新增上下文
工作台
按 Delete 鍵關閉目前標籤頁。

README.md


28 行· 2 KB

我的線上作品集（包含3D模型與捲動互動）
這是一個範例靜態網站，使用 Three.js 加載assets/me.glb，並以頁面捲動控制模型旋轉。您可以將此儲存庫部署到 GitHub Pages 作為您的特色線上作品集。

快速步驟

建立repo（GitHub網頁或CLI）。
把本專案檔案夾repo：index.html、styles.css、script.js、README.md，並建立assets/資料夾。
把你的 3D 模型放置起來assets/me.glb。
新增任何作品圖片（範例用assets/sample-1.jpg等）。
推送到GitHub。
本地測試

使用簡單的HTTP伺服器（因為模型和模組需透過HTTP）：
Python: python3 -m http.server 8000，然後開啟http://localhost:8000
或使用 Node 的 http-server:npx http-server . -p 8000
部署到GitHub Pages（建議）

建立repo（例如username/portfolio），把文件推上main（或master）分支。
GitHub網頁設定>頁面：選擇分支（例如main）與root（/），儲存。稍等幾分鐘，頁面就會https://<your-username>.github.io/<repo>/可用。
或使用gh-pages分支/Action自動部署（如果你熟悉CI）。
注意事項與建議

請輸入你的me.glb位置assets/me.glb（或更新 script.js 的路徑）。
若模型很大，建議先使用 glTF 壓縮工具（如 Draco）或降低材質貼圖大小以改善載入與效能。
我把 3D 允許設定為固定不禿互動（指標事件：無），你可以改成吸引（鼠標拖曳）再加上 OrbitControls。
如果需要更多的互動（例如在不同的區塊對應不同的角度或動畫序列），我可以幫忙把每個部分對應到不同的關鍵影格或用 GSAP / ScrollTrigger 做更高精準度的控制。
如果你要我替你把倉庫建立並直接上傳（我需要倉庫名稱與權限/授權方式），或者想我把範例改成其他佈局（模型在左邊、內容在右邊，或者啟用鼠標拖曳），請告訴我下一步要我代勞哪一項，我會接著處理。


解釋
