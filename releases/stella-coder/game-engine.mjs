import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { execSync } from "node:child_process"

const GAMES_DIR = path.join(os.homedir(), ".stella", "games")

function ensureDir() {
  if (!fs.existsSync(GAMES_DIR)) fs.mkdirSync(GAMES_DIR, { recursive: true })
}

function openFile(filePath) {
  try {
    if (process.platform === "win32") {
      execSync(`start "" "${filePath}"`, { shell: "cmd.exe", stdio: "ignore" })
    } else if (process.platform === "darwin") {
      execSync(`open "${filePath}"`, { stdio: "ignore" })
    } else {
      execSync(`xdg-open "${filePath}"`, { stdio: "ignore" })
    }
  } catch {}
}

function saveAndOpen(html, name) {
  ensureDir()
  const filename = `${name.replace(/[^a-zA-Z0-9_-]/g, "_")}_${Date.now()}.html`
  const filePath = path.join(GAMES_DIR, filename)
  fs.writeFileSync(filePath, html)
  openFile(filePath)
  return { success: true, path: filePath, filename }
}

const SNAKE_GAME = `
<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Snake</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#1e1e2e;color:#cdd6f4;font-family:'Segoe UI',system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;overflow:hidden}
h1{font-size:24px;margin-bottom:8px;color:#a6e3a1}
.info{display:flex;gap:24px;margin-bottom:12px;font-size:14px;color:#a6adc8}
canvas{border:2px solid #45475a;border-radius:8px;background:#181825}
.controls{margin-top:12px;display:flex;gap:8px}
.controls button{padding:8px 16px;border:1px solid #45475a;border-radius:6px;background:#313244;color:#cdd6f4;cursor:pointer;font-size:14px}
.controls button:hover{background:#45475a}
.gameover{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(30,30,46,0.95);padding:32px;border-radius:16px;text-align:center;display:none;border:2px solid #f38ba8}
.gameover h2{color:#f38ba8;margin-bottom:8px}
.gameover p{color:#a6adc8;margin-bottom:16px}
</style></head><body>
<h1>Snake</h1>
<div class="info"><span>Очки: <b id="score">0</b></span><span>Рекорд: <b id="best">0</b></span></div>
<canvas id="c" width="400" height="400"></canvas>
<div class="controls">
<button onclick="startGame()">Заново</button>
</div>
<div class="gameover" id="go">
<h2>Игра окончена!</h2>
<p>Очки: <b id="finalScore">0</b></p>
<button onclick="startGame();document.getElementById('go').style.display='none'" style="padding:10px 24px;border:1px solid #f38ba8;border-radius:6px;background:#f38ba8;color:#1e1e2e;cursor:pointer;font-size:16px">Заново</button>
</div>
<script>
const c=document.getElementById('c'),ctx=c.getContext('2d');
const S=20,W=c.width/S,H=c.height/S;
let snake,food,score,best=+localStorage.getItem('snakeBest')||0,dir,loop,speed;
document.getElementById('best').textContent=best;

function startGame(){
  snake=[{x:10,y:10}];dir={x:1,y:0};score=0;speed=120;
  document.getElementById('score').textContent=0;
  document.getElementById('go').style.display='none';
  placeFood();
  clearInterval(loop);
  loop=setInterval(tick,speed);
}

function placeFood(){
  do{food={x:Math.floor(Math.random()*W),y:Math.floor(Math.random()*H)}}
  while(snake.some(s=>s.x===food.x&&s.y===food.y));
}

function tick(){
  const head={x:snake[0].x+dir.x,y:snake[0].y+dir.y};
  if(head.x<0||head.x>=W||head.y<0||head.y>=H||snake.some(s=>s.x===head.x&&s.y===head.y)){
    clearInterval(loop);
    if(score>best){best=score;localStorage.setItem('snakeBest',best);document.getElementById('best').textContent=best}
    document.getElementById('finalScore').textContent=score;
    document.getElementById('go').style.display='block';
    return;
  }
  snake.unshift(head);
  if(head.x===food.x&&head.y===food.y){
    score+=10;
    document.getElementById('score').textContent=score;
    placeFood();
    if(speed>60){speed-=2;clearInterval(loop);loop=setInterval(tick,speed)}
  }else snake.pop();
  draw();
}

function draw(){
  ctx.fillStyle='#181825';ctx.fillRect(0,0,c.width,c.height);
  snake.forEach((s,i)=>{
    ctx.fillStyle=i?'#a6e3a1':'#94e2d5';
    ctx.fillRect(s.x*S+1,s.y*S+1,S-2,S-2);
  });
  ctx.fillStyle='#f38ba8';
  ctx.beginPath();ctx.arc(food.x*S+S/2,food.y*S+S/2,S/2-2,0,Math.PI*2);ctx.fill();
}

document.addEventListener('keydown',e=>{
  const map={ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},
    w:{x:0,y:-1},s:{x:0,y:1},a:{x:-1,y:0},d:{x:1,y:0}};
  const nd=map[e.key];
  if(nd&&!(nd.x===-dir.x&&nd.y===-dir.y)){dir=nd;e.preventDefault()}
});

let tx=0,ty=0;
c.addEventListener('touchstart',e=>{tx=e.touches[0].clientX;ty=e.touches[0].clientY;e.preventDefault()},{passive:false});
c.addEventListener('touchmove',e=>{
  const dx=e.touches[0].clientX-tx,dy=e.touches[0].clientY-ty;
  if(Math.abs(dx)>Math.abs(dy)){dir={x:dx>0?1:-1,y:0}}else{dir={x:0,y:dy>0?1:-1}}
  e.preventDefault();
},{passive:false});

startGame();
</script></body></html>`

const TETRIS_GAME = `
<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Tetris</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#1e1e2e;color:#cdd6f4;font-family:'Segoe UI',system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;overflow:hidden}
h1{font-size:24px;margin-bottom:8px;color:#89b4fa}
.info{display:flex;gap:24px;margin-bottom:12px;font-size:14px;color:#a6adc8}
canvas{border:2px solid #45475a;border-radius:8px;background:#181825}
.controls{margin-top:12px;display:flex;gap:8px}
.controls button{padding:8px 16px;border:1px solid #45475a;border-radius:6px;background:#313244;color:#cdd6f4;cursor:pointer;font-size:14px}
.controls button:hover{background:#45475a}
</style></head><body>
<h1>Tetris</h1>
<div class="info"><span>Очки: <b id="score">0</b></span><span>Уровень: <b id="level">1</b></span></div>
<canvas id="c" width="300" height="600"></canvas>
<div class="controls">
<button onclick="startGame()">Заново</button>
</div>
<script>
const c=document.getElementById('c'),ctx=c.getContext('2d');
const COLS=10,ROWS=20,S=30;
const PIECES=[[[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]],[[0,1,1],[1,1,0]],[[1,1,0],[0,1,1]]];
const COLORS=['#f38ba8','#fab387','#f9e2af','#a6e3a1','#89b4fa','#cba6f7','#94e2d5'];
let board,piece,pX,pY,color,score,level,lines,loop,speed;

function startGame(){
  board=Array.from({length:ROWS},()=>Array(COLS).fill(0));
  score=0;level=1;lines=0;speed=500;
  document.getElementById('score').textContent=0;
  document.getElementById('level').textContent=1;
  spawn();clearInterval(loop);loop=setInterval(tick,speed);
}

function spawn(){
  const i=Math.floor(Math.random()*PIECES.length);
  piece=PIECES[i];color=COLORS[i];pX=Math.floor((COLS-piece[0].length)/2);pY=0;
  if(collides(piece,pX,pY)){clearInterval(loop);alert('Game Over! Score: '+score)}
}

function collides(p,px,py){
  for(let r=0;r<p.length;r++)for(let c=0;c<p[r].length;c++)
    if(p[r][c]&&(py+r>=ROWS||px+c<0||px+c>=COLS||board[py+r]?.[px+c]))return true;
  return false;
}

function merge(){
  for(let r=0;r<piece.length;r++)for(let c=0;c<piece[r].length;c++)
    if(piece[r][c])board[pY+r][pX+c]=color;
}

function clearLines(){
  let cleared=0;
  for(let r=ROWS-1;r>=0;r--){
    if(board[r].every(c=>c)){board.splice(r,1);board.unshift(Array(COLS).fill(0));cleared++;r++}
  }
  if(cleared){lines+=cleared;score+=[0,100,300,500,800][cleared]*level;level=Math.floor(lines/10)+1;
    document.getElementById('score').textContent=score;document.getElementById('level').textContent=level;
    clearInterval(loop);speed=Math.max(50,500-level*40);loop=setInterval(tick,speed)}
}

function tick(){
  if(!collides(piece,pX,pY+1)){pY++}else{merge();clearLines();spawn()}draw();
}

function draw(){
  ctx.fillStyle='#181825';ctx.fillRect(0,0,c.width,c.height);
  for(let r=0;r<ROWS;r++)for(let cl=0;cl<COLS;cl++)
    if(board[r][cl]){ctx.fillStyle=board[r][cl];ctx.fillRect(cl*S+1,r*S+1,S-2,S-2)}
  ctx.fillStyle=color;
  for(let r=0;r<piece.length;r++)for(let cl=0;cl<piece[r].length;cl++)
    if(piece[r][cl])ctx.fillRect((pX+cl)*S+1,(pY+r)*S+1,S-2,S-2);
  ctx.strokeStyle='#45475a';ctx.lineWidth=0.5;
  for(let r=0;r<=ROWS;r++){ctx.beginPath();ctx.moveTo(0,r*S);ctx.lineTo(c.width,r*S);ctx.stroke()}
  for(let cl=0;cl<=COLS;cl++){ctx.beginPath();ctx.moveTo(cl*S,0);ctx.lineTo(cl*S,c.height);ctx.stroke()}
}

function rotate(){
  const rot=piece[0].map((_,i)=>piece.map(r=>r[i]).reverse());
  if(!collides(rot,pX,pY))piece=rot;
}

document.addEventListener('keydown',e=>{
  const map={ArrowLeft:()=>{if(!collides(piece,pX-1,pY))pX--},
    ArrowRight:()=>{if(!collides(piece,pX+1,pY))pX++},
    ArrowDown:()=>{if(!collides(piece,pX,pY+1)){pY++}else{merge();clearLines();spawn()}draw()},
    ArrowUp:()=>rotate(),' ':()=>{while(!collides(piece,pX,pY+1))pY++;merge();clearLines();spawn();draw()}};
  if(map[e.key]){map[e.key]();e.preventDefault()}
});

let tx=0;
c.addEventListener('touchstart',e=>{tx=e.touches[0].clientX;e.preventDefault()},{passive:false});
c.addEventListener('touchend',e=>{
  const dx=e.changedTouches[0].clientX-tx;
  if(Math.abs(dx)>50){dx>0?!collides(piece,pX+1,pY)&&pX++:!collides(piece,pX-1,pY)&&pX--}
  else{!collides(piece,pX,pY+1)?pY++:(merge(),clearLines(),spawn())}
  draw();
});

startGame();
</script></body></html>`

const MINESWEEPER_GAME = `
<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Minesweeper</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#1e1e2e;color:#cdd6f4;font-family:'Segoe UI',system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;overflow:hidden}
h1{font-size:24px;margin-bottom:8px;color:#f9e2af}
.info{display:flex;gap:24px;margin-bottom:12px;font-size:14px;color:#a6adc8}
.board{display:inline-grid;gap:2px;background:#45475a;padding:4px;border-radius:8px}
.cell{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:4px;cursor:pointer;font-size:14px;font-weight:bold;user-select:none}
.cell.hidden{background:#313244}.cell.hidden:hover{background:#45475a}
.cell.revealed{background:#1e1e2e}
.cell.mine{background:#f38ba8}
.cell.flagged{background:#f9e2af;color:#1e1e2e}
.controls{margin-top:12px;display:flex;gap:8px}
.controls button{padding:8px 16px;border:1px solid #45475a;border-radius:6px;background:#313244;color:#cdd6f4;cursor:pointer;font-size:14px}
.controls button:hover{background:#45475a}
</style></head><body>
<h1>Minesweeper</h1>
<div class="info"><span>Мины: <b id="mines">0</b></span><span>Флаги: <b id="flags">0</b></span></div>
<div class="board" id="board"></div>
<div class="controls"><button onclick="initGame()">Заново</button></div>
<script>
const ROWS=10,COLS=10,MINES=15;
let board,revealed,flagged,gameOver,firstClick;
const colors=['','#89b4fa','#a6e3a1','#f38ba8','#cba6f7','#fab387','#94e2d5','#cdd6f4','#6c7086'];

function initGame(){
  board=Array.from({length:ROWS},()=>Array(COLS).fill(0));
  revealed=Array.from({length:ROWS},()=>Array(COLS).fill(false));
  flagged=Array.from({length:ROWS},()=>Array(COLS).fill(false));
  gameOver=false;firstClick=true;
  document.getElementById('mines').textContent=MINES;
  document.getElementById('flags').textContent=0;
  render();
}

function placeMines(safeR,safeC){
  let placed=0;
  while(placed<MINES){
    const r=Math.floor(Math.random()*ROWS),c=Math.floor(Math.random()*COLS);
    if(board[r][c]!==-1&&Math.abs(r-safeR)>1&&Math.abs(c-safeC)>1){board[r][c]=-1;placed++}
  }
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
    if(board[r][c]===-1)continue;
    let count=0;
    for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
      const nr=r+dr,nc=c+dc;
      if(nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&board[nr][nc]===-1)count++;
    }
    board[r][c]=count;
  }
}

function reveal(r,c){
  if(r<0||r>=ROWS||c<0||c>=COLS||revealed[r][c]||flagged[r][c])return;
  revealed[r][c]=true;
  if(board[r][c]===0){for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)reveal(r+dr,c+dc)}
}

function render(){
  const el=document.getElementById('board');
  el.style.gridTemplateColumns='repeat('+COLS+',32px)';
  el.innerHTML='';
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
    const cell=document.createElement('div');
    cell.className='cell';
    if(revealed[r][c]){
      cell.classList.add('revealed');
      if(board[r][c]===-1){cell.classList.add('mine');cell.textContent='💣'}
      else if(board[r][c]>0){cell.textContent=board[r][c];cell.style.color=colors[board[r][c]]}
    }else{
      cell.classList.add('hidden');
      if(flagged[r][c]){cell.classList.add('flagged');cell.textContent='🚩'}
    }
    cell.addEventListener('click',()=>{
      if(gameOver||flagged[r][c])return;
      if(firstClick){firstClick=false;placeMines(r,c)}
      if(board[r][c]===-1){gameOver=true;for(let rr=0;rr<ROWS;rr++)for(let cc=0;cc<COLS;cc++)if(board[rr][cc]===-1)revealed[rr][cc]=true;render();alert('Game Over!');return}
      reveal(r,c);
      let unrevealed=0;for(let rr=0;rr<ROWS;rr++)for(let cc=0;cc<COLS;cc++)if(!revealed[rr][cc]&&board[rr][cc]!==-1)unrevealed++;
      if(unrevealed===0){gameOver=true;alert('You Win!')}render();
    });
    cell.addEventListener('contextmenu',e=>{
      e.preventDefault();if(gameOver||revealed[r][c])return;
      flagged[r][c]=!flagged[r][c];
      document.getElementById('flags').textContent=document.querySelectorAll('.flagged').length;
      render();
    });
    el.appendChild(cell);
  }
}

initGame();
</script></body></html>`

const GAME_2048 = `
<!DOCTYPE html><html><head><meta charset="UTF-8"><title>2048</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#1e1e2e;color:#cdd6f4;font-family:'Segoe UI',system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;overflow:hidden}
h1{font-size:24px;margin-bottom:8px;color:#fab387}
.info{display:flex;gap:24px;margin-bottom:12px;font-size:14px;color:#a6adc8}
.board{display:grid;grid-template-columns:repeat(4,80px);gap:8px;background:#45475a;padding:8px;border-radius:12px}
.cell{width:80px;height:80px;display:flex;align-items:center;justify-content:center;border-radius:8px;font-size:24px;font-weight:bold;background:#313244;transition:all 0.15s}
.controls{margin-top:12px;display:flex;gap:8px}
.controls button{padding:8px 16px;border:1px solid #45475a;border-radius:6px;background:#313244;color:#cdd6f4;cursor:pointer;font-size:14px}
</style></head><body>
<h1>2048</h1>
<div class="info"><span>Очки: <b id="score">0</b></span><span>Рекорд: <b id="best">0</b></span></div>
<div class="board" id="board"></div>
<div class="controls"><button onclick="startGame()">Заново</button></div>
<script>
let grid,score,best=+localStorage.getItem('2048best')||0;
document.getElementById('best').textContent=best;

function startGame(){
  grid=Array.from({length:4},()=>Array(4).fill(0));score=0;
  document.getElementById('score').textContent=0;
  document.getElementById('go')&&(document.getElementById('go').style.display='none');
  addTile();addTile();render();
}

function addTile(){
  const empty=[];for(let r=0;r<4;r++)for(let c=0;c<4;c++)if(!grid[r][c])empty.push([r,c]);
  if(!empty.length)return;
  const[r,c]=empty[Math.floor(Math.random()*empty.length)];
  grid[r][c]=Math.random()<0.9?2:4;
}

function render(){
  const el=document.getElementById('board');el.innerHTML='';
  const tileColors={0:'#313244',2:'#cdd6f4',4:'#a6adc8',8:'#fab387',16:'#f38ba8',32:'#eba0ac',64:'#f38ba8',128:'#94e2d5',256:'#a6e3a1',512:'#f9e2af',1024:'#89b4fa',2048:'#cba6f7'};
  for(let r=0;r<4;r++)for(let c=0;c<4;c++){
    const cell=document.createElement('div');cell.className='cell';
    cell.style.background=tileColors[grid[r][c]]||'#cba6f7';
    cell.style.color=grid[r][c]<=4?'#1e1e2e':'#cdd6f4';
    cell.textContent=grid[r][c]||'';el.appendChild(cell);
  }
}

function slide(row){
  let a=row.filter(x=>x);for(let i=0;i<a.length-1;i++)if(a[i]===a[i+1]){a[i]*=2;a[i+1]=0;score+=a[i]}
  while(a.length<4)a.push(0);return a;
}

function move(dir){
  let moved=false;const prev=JSON.stringify(grid);
  if(dir==='left'){for(let r=0;r<4;r++)grid[r]=slide(grid[r])}
  else if(dir==='right'){for(let r=0;r<4;r++)grid[r]=slide(grid[r].reverse()).reverse()}
  else if(dir==='up'){for(let c=0;c<4;c++){const col=slide([grid[0][c],grid[1][c],grid[2][c],grid[3][c]]);for(let r=0;r<4;r++)grid[r][c]=col[r]}}
  else if(dir==='down'){for(let c=0;c<4;c++){const col=slide([grid[3][c],grid[2][c],grid[1][c],grid[0][c]]);for(let r=0;r<4;r++)grid[r][c]=col[3-r]}}
  if(JSON.stringify(grid)!==prev){moved=true;addTile()}
  document.getElementById('score').textContent=score;
  if(score>best){best=score;localStorage.setItem('2048best',best);document.getElementById('best').textContent=best}
  if(moved)render();
  if(!canMove()){alert('Game Over! Score: '+score)}
}

function canMove(){
  for(let r=0;r<4;r++)for(let c=0;c<4;c++){
    if(!grid[r][c])return true;
    if(c<3&&grid[r][c]===grid[r][c+1])return true;
    if(r<3&&grid[r][c]===grid[r+1][c])return true;
  }
  return false;
}

document.addEventListener('keydown',e=>{
  const map={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',a:'left',d:'right',w:'up',s:'down'};
  if(map[e.key]){move(map[e.key]);e.preventDefault()}
});

let tx=0,ty=0;
document.addEventListener('touchstart',e=>{tx=e.touches[0].clientX;ty=e.touches[0].clientY;e.preventDefault()},{passive:false});
document.addEventListener('touchend',e=>{
  const dx=e.changedTouches[0].clientX-tx,dy=e.changedTouches[0].clientY-ty;
  if(Math.abs(dx)>Math.abs(dy)){dx>0?move('right'):move('left')}else{dy>0?move('down'):move('up')}
});

startGame();
</script></body></html>`

const FLAPPY_BIRD_GAME = `
<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Flappy Bird</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#1e1e2e;color:#cdd6f4;font-family:'Segoe UI',system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;overflow:hidden}
h1{font-size:24px;margin-bottom:8px;color:#f9e2af}
.info{display:flex;gap:24px;margin-bottom:12px;font-size:14px;color:#a6adc8}
canvas{border:2px solid #45475a;border-radius:8px;background:#181825}
.controls{margin-top:12px;display:flex;gap:8px}
.controls button{padding:8px 16px;border:1px solid #45475a;border-radius:6px;background:#313244;color:#cdd6f4;cursor:pointer;font-size:14px}
</style></head><body>
<h1>Flappy Bird</h1>
<div class="info"><span>Очки: <b id="score">0</b></span><span>Рекорд: <b id="best">0</b></span></div>
<canvas id="c" width="400" height="600"></canvas>
<div class="controls"><button onclick="startGame()">Заново</button></div>
<script>
const c=document.getElementById('c'),ctx=c.getContext('2d');
let bird,pipes,score,best=+localStorage.getItem('flappyBest')||0,frame,gravity=0.5,jump=-8,pipeW=60,pipeGap=150,speed=2,running=false;
document.getElementById('best').textContent=best;

function startGame(){
  bird={x:100,y:300,vy:0,r:15};pipes=[];score=0;frame=0;running=true;
  document.getElementById('score').textContent=0;
  for(let i=0;i<5;i++)pipes.push({x:400+i*200,h:100+Math.random()*300});
  cancelAnimationFrame(loop);loop=requestAnimationFrame(tick);
}

function tick(){
  if(!running)return;
  bird.vy+=gravity;bird.y+=bird.vy;
  if(bird.y>c.height||bird.y<0)endGame();
  if(frame%90===0)pipes.push({x:c.width,h:80+Math.random()*(c.height-300)});
  pipes.forEach(p=>{p.x-=speed;
    if(p.x+pipeW>bird.x-bird.r&&p.x<bird.x+bird.r){
      if(bird.y-bird.r<p.h||bird.y+bird.r>p.h+pipeGap)endGame();
    }
    if(p.x+pipeW<bird.x&&!p.scored){p.scored=true;score++;document.getElementById('score').textContent=score}
  });
  pipes=pipes.filter(p=>p.x>-pipeW);
  draw();frame=requestAnimationFrame(tick);
}

function draw(){
  ctx.fillStyle='#181825';ctx.fillRect(0,0,c.width,c.height);
  pipes.forEach(p=>{
    ctx.fillStyle='#a6e3a1';ctx.fillRect(p.x,0,pipeW,p.h);ctx.fillRect(p.x,p.h+pipeGap,pipeW,c.height);
    ctx.fillStyle='#94e2d5';ctx.fillRect(p.x-2,p.h-10,pipeW+4,10);ctx.fillRect(p.x-2,p.h+pipeGap,pipeW+4,10);
  });
  ctx.fillStyle='#f9e2af';ctx.beginPath();ctx.arc(bird.x,bird.y,bird.r,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#1e1e2e';ctx.beginPath();ctx.arc(bird.x+5,bird.y-3,3,0,Math.PI*2);ctx.fill();
}

function endGame(){
  running=false;
  if(score>best){best=score;localStorage.setItem('flappyBest',best);document.getElementById('best').textContent=best}
  alert('Game Over! Score: '+score);
}

document.addEventListener('keydown',e=>{if(e.code==='Space'||e.code==='ArrowUp'){if(running)bird.vy=jump;e.preventDefault()}});
c.addEventListener('click',()=>{if(running)bird.vy=jump});
c.addEventListener('touchstart',e=>{if(running)bird.vy=jump;e.preventDefault()},{passive:false});

startGame();
</script></body></html>`

const TIC_TAC_TOE_GAME = `
<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Tic Tac Toe</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#1e1e2e;color:#cdd6f4;font-family:'Segoe UI',system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;overflow:hidden}
h1{font-size:24px;margin-bottom:8px;color:#89b4fa}
.info{margin-bottom:12px;font-size:16px;color:#a6adc8;min-height:24px}
.board{display:grid;grid-template-columns:repeat(3,100px);gap:8px}
.cell{width:100px;height:100px;display:flex;align-items:center;justify-content:center;background:#313244;border-radius:8px;font-size:40px;cursor:pointer;transition:all 0.2s}
.cell:hover{background:#45475a}
.cell.x{color:#89b4fa}.cell.o{color:#f38ba8}.cell.win{background:#a6e3a1;color:#1e1e2e}
.controls{margin-top:16px;display:flex;gap:8px}
.controls button{padding:8px 16px;border:1px solid #45475a;border-radius:6px;background:#313244;color:#cdd6f4;cursor:pointer;font-size:14px}
</style></head><body>
<h1>Tic Tac Toe</h1>
<div class="info" id="info">Ход X</div>
<div class="board" id="board"></div>
<div class="controls">
<button onclick="startGame()">Заново</button>
<button onclick="toggleMode()">Режим: <span id="mode">Игрок vs Игрок</span></button>
</div>
<script>
let board,turn,gameOver,pvpMode=true;
const wins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

function startGame(){
  board=Array(9).fill('');turn='X';gameOver=false;
  document.getElementById('info').textContent='Ход X';
  render();
}

function toggleMode(){
  pvpMode=!pvpMode;
  document.getElementById('mode').textContent=pvpMode?'Игрок vs ИИ':'Игрок vs Игрок';
  startGame();
}

function render(){
  const el=document.getElementById('board');el.innerHTML='';
  board.forEach((v,i)=>{
    const cell=document.createElement('div');cell.className='cell'+(v?' '+v.toLowerCase():'');
    cell.textContent=v;
    cell.addEventListener('click',()=>play(i));
    el.appendChild(cell);
  });
}

function play(i){
  if(board[i]||gameOver)return;
  board[i]=turn;render();
  if(checkWin(turn)){document.getElementById('info').textContent=turn+' победил!';gameOver=true;highlightWin();return}
  if(board.every(c=>c)){document.getElementById('info').textContent='Ничья!';gameOver=true;return}
  turn=turn==='X'?'O':'X';
  document.getElementById('info').textContent='Ход '+turn;
  if(!pvpMode&&turn==='O'&&!gameOver)aiMove();
}

function aiMove(){
  for(const w of wins){
    const vals=w.map(i=>board[i]);
    if(vals.filter(v=>v==='O').length===2&&vals.includes('')){play(w[vals.indexOf('')]);return}
  }
  for(const w of wins){
    const vals=w.map(i=>board[i]);
    if(vals.filter(v=>v==='X').length===2&&vals.includes('')){play(w[vals.indexOf('')]);return}
  }
  if(!board[4]){play(4);return}
  const corners=[0,2,6,8].filter(i=>!board[i]);
  if(corners.length){play(corners[Math.floor(Math.random()*corners.length)]);return}
  const empty=board.map((v,i)=>v?'':i).filter(v=>v!=='');
  if(empty.length)play(empty[Math.floor(Math.random()*empty.length)]);
}

function checkWin(p){
  return wins.some(w=>w.every(i=>board[i]===p));
}

function highlightWin(){
  const w=wins.find(w=>w.every(i=>board[i]===turn));
  if(w){const cells=document.querySelectorAll('.cell');w.forEach(i=>cells[i].classList.add('win'))}
}

startGame();
</script></body></html>`

const SUDOKU_GAME = `
<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Sudoku</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#1e1e2e;color:#cdd6f4;font-family:'Segoe UI',system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;overflow:hidden}
h1{font-size:24px;margin-bottom:8px;color:#cba6f7}
.info{display:flex;gap:24px;margin-bottom:12px;font-size:14px;color:#a6adc8}
.board{display:grid;grid-template-columns:repeat(9,40px);gap:1px;background:#45475a;padding:2px;border-radius:8px}
.cell{width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:#313244;font-size:18px;cursor:pointer;transition:all 0.15s}
.cell:hover{background:#45475a}
.cell.fixed{color:#6c7086;font-weight:bold}
.cell.selected{background:#45475a;box-shadow:inset 0 0 0 2px #89b4fa}
.cell.error{color:#f38ba8}
.cell.correct{color:#a6e3a1}
.numpad{margin-top:12px;display:flex;gap:4px;flex-wrap:wrap;justify-content:center;max-width:370px}
.numpad button{width:40px;height:40px;border:1px solid #45475a;border-radius:6px;background:#313244;color:#cdd6f4;cursor:pointer;font-size:16px}
.numpad button:hover{background:#45475a}
.controls{margin-top:12px;display:flex;gap:8px}
.controls button{padding:8px 16px;border:1px solid #45475a;border-radius:6px;background:#313244;color:#cdd6f4;cursor:pointer;font-size:14px}
</style></head><body>
<h1>Sudoku</h1>
<div class="info"><span>Ошибки: <b id="errors">0</b>/3</span></div>
<div class="board" id="board"></div>
<div class="numpad" id="numpad"></div>
<div class="controls"><button onclick="newGame()">Новая игра</button></div>
<script>
let puzzle,solution,selected,errors;
const easy=[[0,0,3,0,2,0,6,0,0],[9,0,0,3,0,5,0,0,1],[0,0,1,8,0,6,4,0,0],[0,0,8,1,0,2,9,0,0],[7,0,0,0,0,0,0,0,8],[0,0,6,7,0,8,2,0,0],[0,0,2,6,0,9,5,0,0],[8,0,0,2,0,3,0,0,9],[0,0,5,0,1,0,3,0,0]];
const solutionEasy=[[4,8,3,9,2,1,6,5,7],[9,6,7,3,4,5,8,2,1],[2,5,1,8,7,6,4,9,3],[5,4,8,1,3,2,9,7,6],[7,2,9,5,6,4,1,3,8],[1,3,6,7,9,8,2,4,5],[3,7,2,6,8,9,5,1,4],[8,1,4,2,5,3,7,6,9],[6,9,5,4,1,7,3,8,2]];

function newGame(){
  puzzle=easy.map(r=>[...r]);solution=solutionEasy;selected=null;errors=0;
  document.getElementById('errors').textContent=0;
  render();
}

function render(){
  const el=document.getElementById('board');el.innerHTML='';
  for(let r=0;r<9;r++)for(let c=0;c<9;c++){
    const cell=document.createElement('div');cell.className='cell';
    const val=puzzle[r][c];
    if(val)cell.textContent=val;
    if(easy[r][c])cell.classList.add('fixed');
    if(selected&&selected.r===r&&selected.c===c)cell.classList.add('selected');
    if(val&&solution[r][c]&&val!==solution[r][c])cell.classList.add('error');
    else if(val&&solution[r][c]&&val===solution[r][c]&&!easy[r][c])cell.classList.add('correct');
    cell.addEventListener('click',()=>{if(!easy[r][c])selected={r,c};render()});
    el.appendChild(cell);
  }
  const np=document.getElementById('numpad');np.innerHTML='';
  for(let n=1;n<=9;n++){
    const btn=document.createElement('button');btn.textContent=n;
    btn.addEventListener('click',()=>placeNumber(n));
    np.appendChild(btn);
  }
}

function placeNumber(n){
  if(!selected)return;
  puzzle[selected.r][selected.c]=n;
  if(n!==solution[selected.r][selected.c]){errors++;document.getElementById('errors').textContent=errors;if(errors>=3){alert('Game Over!');newGame();return}}
  if(puzzle.every((r,ri)=>r.every((c,ci)=>c===solution[ri][ci])))alert('Congratulations! You won!');
  render();
}

document.addEventListener('keydown',e=>{
  if(!selected)return;
  const n=parseInt(e.key);
  if(n>=1&&n<=9)placeNumber(n);
  if(e.key==='Backspace'||e.key==='Delete'){puzzle[selected.r][selected.c]=0;render()}
  const dir={ArrowUp:{r:-1,c:0},ArrowDown:{r:1,c:0},ArrowLeft:{r:0,c:-1},ArrowRight:{r:0,c:1}};
  if(dir[e.key]){selected.r=(selected.r+dir[e.key].r+9)%9;selected.c=(selected.c+dir[e.key].c+9)%9;render();e.preventDefault()}
});

newGame();
</script></body></html>`

export class GameEngine {
  constructor() {
    ensureDir()
  }

  async playSnake() {
    return saveAndOpen(SNAKE_GAME, "snake")
  }

  async playTetris() {
    return saveAndOpen(TETRIS_GAME, "tetris")
  }

  async playMinesweeper() {
    return saveAndOpen(MINESWEEPER_GAME, "minesweeper")
  }

  async play2048() {
    return saveAndOpen(GAME_2048, "2048")
  }

  async playFlappyBird() {
    return saveAndOpen(FLAPPY_BIRD_GAME, "flappy")
  }

  async playTicTacToe() {
    return saveAndOpen(TIC_TAC_TOE_GAME, "tictactoe")
  }

  async playSudoku() {
    return saveAndOpen(SUDOKU_GAME, "sudoku")
  }

  async play(gameName) {
    const games = {
      snake: () => this.playSnake(),
      тетрис: () => this.playTetris(),
      tetris: () => this.playTetris(),
      minesweeper: () => this.playMinesweeper(),
      "мины": () => this.playMinesweeper(),
      2048: () => this.play2048(),
      flappy: () => this.playFlappyBird(),
      "птица": () => this.playFlappyBird(),
      tictactoe: () => this.playTicTacToe(),
      "крестики": () => this.playTicTacToe(),
      sudoku: () => this.playSudoku(),
      "судоку": () => this.playSudoku(),
    }
    const fn = games[gameName?.toLowerCase()]
    if (fn) return fn()
    return { success: false, error: `Unknown game: ${gameName}. Available: ${Object.keys(games).join(", ")}` }
  }

  async createCustomGame(html, name = "custom") {
    return saveAndOpen(html, name)
  }

  listGames() {
    return ["snake", "tetris", "2048", "minesweeper", "flappy-bird", "tic-tac-toe", "sudoku"]
  }

  listSaved() {
    if (!fs.existsSync(GAMES_DIR)) return []
    return fs.readdirSync(GAMES_DIR)
      .filter(f => f.endsWith(".html"))
      .map(f => ({
        name: f,
        path: path.join(GAMES_DIR, f),
        created: fs.statSync(path.join(GAMES_DIR, f)).birthtime,
      }))
      .sort((a, b) => b.created - a.created)
  }
}
