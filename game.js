const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

const timeEl  = document.getElementById("time");
const scoreEl = document.getElementById("score");
const bestEl  = document.getElementById("best");
const restartBtn = document.getElementById("restart");

// --- overlay (created in JS so you only need 3 files) ---
const overlay = document.createElement("div");
overlay.className = "overlay";
overlay.innerHTML = `
  <div class="card">
    <h1 id="endTitle">TIME UP</h1>
    <p>
      <span style="opacity:.85">Score:</span> <span id="endScore">0</span>
      &nbsp;&nbsp;|&nbsp;&nbsp;
      <span style="opacity:.85">High:</span> <span id="endBest">0</span>
    </p>
    <div class="row">
      <button id="endRestart" class="btn">RESTART</button>
    </div>
  </div>
`;
document.body.appendChild(overlay);

const endTitle = document.getElementById("endTitle");
const endScore = document.getElementById("endScore");
const endBest  = document.getElementById("endBest");
const endRestartBtn = document.getElementById("endRestart");

let W, H, dpr;
function getSafeBottom(){
  const vv = window.visualViewport;
  if(!vv) return 0;
  return Math.max(0, window.innerHeight - vv.height - (vv.offsetTop || 0));
}
function resize(){

  dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  W = Math.floor(window.innerWidth);

  const vv = window.visualViewport;
  H = Math.floor(vv ? vv.height : window.innerHeight);

  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);

  ctx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener("resize", resize);
resize();

const GAME_DURATION = 40; // seconds

const state = {
  running: true,
  ended: false,
  score: 0,
  best: Number(localStorage.getItem("turkeyCatchHigh") || 0),
  timeLeft: GAME_DURATION,
  elapsed: 0,
  spawnTimer: 0,
  items: []
};

bestEl.textContent = state.best;
timeEl.textContent = String(state.timeLeft);

// --- YOUR IMAGES (put them in assets/) ---
const imgCatcher = new Image();
imgCatcher.src = "assets/catcher.png";

const imgReward = new Image();
imgReward.src = "assets/reward.png";

const imgBomb = new Image();
imgBomb.src = "assets/bomb.png";

// If images fail, we still draw simple shapes:
function imageReady(img){ return img && img.complete && img.naturalWidth > 0; }

const catcher = {
  // Smaller max size for laptops + still responsive for phones
  w: Math.min(140, W * 0.32),
  h: Math.min(140, W * 0.32),

  x: 0,
  y: 0,
  speed: 760
};


function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

function resetGame(){
  state.running = true;
  state.ended = false;
  state.score = 0;
  state.elapsed = 0;
  state.timeLeft = GAME_DURATION;
  state.spawnTimer = 0;
  state.items.length = 0;

  catcher.x = W/2;
  catcher.y = H - (catcher.h / 2) - 20;

  scoreEl.textContent = "0";
  timeEl.textContent = String(GAME_DURATION);
  overlay.classList.remove("show");
}

restartBtn.addEventListener("click", resetGame);
endRestartBtn.addEventListener("click", resetGame);

// Keyboard control
const keys = { left:false, right:false };
window.addEventListener("keydown", (e)=>{
  if(e.key === "ArrowLeft") keys.left = true;
  if(e.key === "ArrowRight") keys.right = true;
});
window.addEventListener("keyup", (e)=>{
  if(e.key === "ArrowLeft") keys.left = false;
  if(e.key === "ArrowRight") keys.right = false;
});

// Touch / drag control
let dragging = false;
function setCatcherToClientX(clientX){
  catcher.x = clamp(clientX, catcher.w/2 + 10, W - catcher.w/2 - 10);
}
canvas.addEventListener("pointerdown", (e)=>{
  dragging = true;
  setCatcherToClientX(e.clientX);
});
canvas.addEventListener("pointermove", (e)=>{
  e.preventDefault(); // ⭐ يمنع تحريك الصفحة
  if(!dragging) return;
  setCatcherToClientX(e.clientX);
});
window.addEventListener("pointerup", ()=> dragging = false);

function endGame(reason){
  if(state.ended) return;
  state.running = false;
  state.ended = true;

  if(state.score > state.best){
    state.best = state.score;
    localStorage.setItem("turkeyCatchHigh", String(state.best));
    bestEl.textContent = String(state.best);
  }

  endTitle.textContent = reason === "bomb" ? "BOOM!" : "TIME UP";
  endScore.textContent = String(state.score);
  endBest.textContent  = String(state.best);
  overlay.classList.add("show");
}

function spawn(){

  // ⭐ حساب مستوى السرعة كل 10 ثواني
  // level = 0 / 1 / 2 / 3
  const level = Math.floor(state.elapsed / 5);

  // زيادة السرعة حسب الوقت
  // كل مستوى يزيد السرعة
  const speedMultiplier = 1 + (level * 0.35);

  // نسبة القنابل تزيد شوي مع الوقت
  const pBomb = clamp(0.12 + level * 0.05, 0.15, 0.38);
  const isBomb = Math.random() < pBomb;

  const size = isBomb ? 50 : 55;

  const x = (size/2) + Math.random() * (W - size);
  const y = -60;

  // ⭐ السرعة الأساسية * المضاعف
  const base = 220 * speedMultiplier;
  const vy = base + Math.random() * (160 * speedMultiplier);

  state.items.push({ x, y, size, vy, isBomb });
}


function update(dt){
  if(!state.running) return;

  state.elapsed += dt;
  state.timeLeft = Math.max(0, GAME_DURATION - state.elapsed);
  timeEl.textContent = String(Math.ceil(state.timeLeft));

  if(state.timeLeft <= 0){
    endGame("time");
    return;
  }

  state.spawnTimer -= dt;
  const interval = Math.max(0.23, 0.85 - state.elapsed * 0.025);
  if(state.spawnTimer <= 0){
    spawn();
    state.spawnTimer = interval;
  }

  // movement
  let dir = 0;
  if(keys.left) dir -= 1;
  if(keys.right) dir += 1;

  if(dir !== 0){
    catcher.x += dir * catcher.speed * dt;
    catcher.x = clamp(catcher.x, catcher.w/2 + 10, W - catcher.w/2 - 10);
  }

  const safeBottom = getSafeBottom();
catcher.y = H - (catcher.h / 2) - safeBottom - 10;

  // items update + collision (rect-rect simple)
  const cx = catcher.x - catcher.w/2;
  const cy = catcher.y - catcher.h/2;

  for(let i = state.items.length - 1; i >= 0; i--){
    const it = state.items[i];
    it.y += it.vy * dt;

    if(it.y > H + 80){
      state.items.splice(i, 1);
      continue;
    }

    // item rect
    const ix = it.x - it.size/2;
    const iy = it.y - it.size/2;

    const overlap =
      ix < cx + catcher.w &&
      ix + it.size > cx &&
      iy < cy + catcher.h &&
      iy + it.size > cy;

    if(overlap){
      state.items.splice(i, 1);
      if(it.isBomb){
        endGame("bomb");
        return;
      }else{
        state.score += 1;
        scoreEl.textContent = String(state.score);
      }
    }
  }
}

function draw(){
  ctx.clearRect(0,0,W,H);

  // background
  ctx.fillStyle = "#0b1020";
  ctx.fillRect(0,0,W,H);

  // small stars
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#ffffff";
  for(let i=0;i<36;i++){
    const x = (i*97) % W;
    const y = (i*173) % H;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;

  // draw catcher image (or fallback)
  const drawX = catcher.x - catcher.w/2;
  const drawY = catcher.y - catcher.h/2;

  if(imageReady(imgCatcher)){
    ctx.drawImage(imgCatcher, drawX, drawY, catcher.w, catcher.h);
  } else {
    ctx.fillStyle = "#f7b500";
    roundRect(drawX, drawY, catcher.w, catcher.h, 12);
    ctx.fill();
  }

  // draw falling items (images)
  for(const it of state.items){
    const x = it.x - it.size/2;
    const y = it.y - it.size/2;

    if(it.isBomb){
      if(imageReady(imgBomb)){
        ctx.drawImage(imgBomb, x, y, it.size, it.size);
      } else {
        ctx.fillStyle = "#ff3b3b";
        ctx.beginPath(); ctx.arc(it.x,it.y,it.size/2,0,Math.PI*2); ctx.fill();
      }
    } else {
      if(imageReady(imgReward)){
        ctx.drawImage(imgReward, x, y, it.size, it.size);
      } else {
        ctx.fillStyle = "#2dff8f";
        ctx.beginPath(); ctx.arc(it.x,it.y,it.size/2,0,Math.PI*2); ctx.fill();
      }
    }
  }
}

function roundRect(x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}

let last = performance.now();
function loop(t){
  const dt = Math.min(0.033, (t - last) / 1000);
  last = t;

  if(W !== window.innerWidth || H !== window.innerHeight) resize();

  update(dt);
  draw();
  requestAnimationFrame(loop);
}

resetGame();
requestAnimationFrame(loop);
