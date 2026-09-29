// ─── تجهيز شاشة اللعبة ───
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const player = {
  x: canvas.width / 2 - 22,
  y: canvas.height - 75,
  targetX: canvas.width / 2 - 22,
  targetY: canvas.height - 75,
  width: 44,
  height: 42
};

const bullets = [];
const enemies = [];
const particles = [];

const stars = Array.from({ length: 65 }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  size: Math.random() * 1.5 + 0.5,
  speed: Math.random() * 0.8 + 0.3
}));

let dragging = false;
let offsetX = 0;
let offsetY = 0;

let score = 0;
let wave = 1;
let lives = 3;
let gameOver = false;
let invulnerableUntil = 0;

let lastShot = 0;
let lastDive = 0;
let audioContext = null;


// ─── الصوت ───
// المتصفح يسمح بتشغيل الصوت بعد أول ضغطة داخل اللعبة.
function enableAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
}

function playSound(startFrequency, endFrequency, duration, loudness) {
  if (!audioContext || audioContext.state !== "running") return;

  const oscillator = audioContext.createOscillator();
  const volume = audioContext.createGain();
  const now = audioContext.currentTime;

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(startFrequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(
    endFrequency,
    now + duration
  );

  volume.gain.setValueAtTime(loudness, now);
  volume.gain.exponentialRampToValueAtTime(0.001, now + duration);

  oscillator.connect(volume);
  volume.connect(audioContext.destination);

  oscillator.start(now);
  oscillator.stop(now + duration);
}

function playShotSound() {
  playSound(700, 400, 0.055, 0.035);
}

function playHitSound() {
  playSound(420, 130, 0.16, 0.09);
}


// ─── التحكم بالمركبة ───
function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: (event.clientX - rect.left) * canvas.width / rect.width,
    y: (event.clientY - rect.top) * canvas.height / rect.height
  };
}

canvas.addEventListener("pointerdown", (event) => {
  enableAudio();

  if (gameOver) {
    restartGame();
    return;
  }

  const pointer = pointerPosition(event);

  const touchingPlayer =
    pointer.x >= player.x &&
    pointer.x <= player.x + player.width &&
    pointer.y >= player.y &&
    pointer.y <= player.y + player.height;

  if (!touchingPlayer) return;

  dragging = true;
  offsetX = pointer.x - player.x;
  offsetY = pointer.y - player.y;
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  if (!dragging) return;

  const pointer = pointerPosition(event);

  player.targetX = Math.max(
    0,
    Math.min(canvas.width - player.width, pointer.x - offsetX)
  );

  player.targetY = Math.max(
    0,
    Math.min(canvas.height - player.height, pointer.y - offsetY)
  );
});

canvas.addEventListener("pointerup", () => {
  dragging = false;
});

canvas.addEventListener("pointercancel", () => {
  dragging = false;
});

function updatePlayer() {
  player.x += (player.targetX - player.x) * 0.22;
  player.y += (player.targetY - player.y) * 0.22;
}

function drawPlayer() {
  const x = player.x;
  const y = player.y;

  // وهج المحرّك
  ctx.fillStyle = "#ffb86b";
  ctx.beginPath();
  ctx.moveTo(x + 18, y + 34);
  ctx.lineTo(x + 22, y + 48);
  ctx.lineTo(x + 26, y + 34);
  ctx.fill();

  // جسم المركبة والجناحان
  ctx.fillStyle = "#75bfd8";
  ctx.beginPath();
  ctx.moveTo(x + 22, y);
  ctx.lineTo(x + 30, y + 19);
  ctx.lineTo(x + 43, y + 28);
  ctx.lineTo(x + 43, y + 39);
  ctx.lineTo(x + 27, y + 34);
  ctx.lineTo(x + 22, y + 39);
  ctx.lineTo(x + 17, y + 34);
  ctx.lineTo(x + 1, y + 39);
  ctx.lineTo(x + 1, y + 28);
  ctx.lineTo(x + 14, y + 19);
  ctx.closePath();
  ctx.fill();

  // مقدمة المركبة
  ctx.fillStyle = "#d5f5f4";
  ctx.beginPath();
  ctx.moveTo(x + 22, y + 4);
  ctx.lineTo(x + 28, y + 25);
  ctx.lineTo(x + 22, y + 31);
  ctx.lineTo(x + 16, y + 25);
  ctx.closePath();
  ctx.fill();

  // نافذة القيادة
  ctx.fillStyle = "#555198";
  ctx.fillRect(x + 19, y + 18, 6, 8);
}


// ─── الطلقات ───
function shoot(time) {
  if (time - lastShot < 250) return;

  bullets.push({
    x: player.x + player.width / 2 - 2,
    y: player.y - 12,
    width: 4,
    height: 14,
    speed: 8
  });

  playShotSound();
  lastShot = time;
}

function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    bullets[i].y -= bullets[i].speed;

    if (bullets[i].y + bullets[i].height < 0) {
      bullets.splice(i, 1);
    }
  }
}

function drawBullets() {
  ctx.fillStyle = "#ffe68a";

  for (const bullet of bullets) {
    ctx.fillRect(
      bullet.x,
      bullet.y,
      bullet.width,
      bullet.height
    );
  }
}


// ─── الكائنات والموجات ───
function createEnemies() {
  const colors = ["#f29ac2", "#a999f7", "#9cdbb0"];

  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 7; column++) {
      const x = 55 + column * 53;
      const y = 65 + row * 48;

      enemies.push({
        x,
        y,
        homeX: x,
        homeY: y,
        width: 26,
        height: 24,
        color: colors[row],
        state: "formation",
        targetX: x,
        startX: x,
        startY: y
      });
    }
  }
}

function updateEnemies(time) {
  // نختار واحدًا لينقضّ على المركبة كل فترة
  if (time - lastDive > 900) {
    const waiting = enemies.filter(
      (enemy) => enemy.state === "formation"
    );

    if (waiting.length > 0) {
      const enemy = waiting[Math.floor(Math.random() * waiting.length)];
      enemy.state = "diving";
      enemy.targetX = player.x + player.width / 2;
      enemy.startX = enemy.x;
      enemy.startY = enemy.y;
    }

    lastDive = time;
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];

    if (enemy.state === "formation") {
      enemy.x = enemy.homeX + Math.sin(time * 0.002 + enemy.homeY) * 5;
    } else {
      enemy.y += 2.4 + wave * 0.35;

      const progress = Math.min(
        1,
        (enemy.y - enemy.startY) / (canvas.height - enemy.startY)
      );

      const curve = Math.sin(progress * Math.PI * 2) * 65;

      enemy.x =
        enemy.startX +
        (enemy.targetX - enemy.startX) * progress +
        curve;

      // وصل إلى أسفل الشاشة: نخسر 10 نقاط
      if (enemy.y > canvas.height) {
        enemies.splice(i, 1);
        score = Math.max(0, score - 10);
      }
    }
  }
}

function drawEnemies() {
  for (const enemy of enemies) {
    const x = enemy.x;
    const y = enemy.y;

    ctx.fillStyle = enemy.color;
    ctx.fillRect(x + 7, y + 5, 12, 14);
    ctx.fillRect(x, y + 8, 7, 9);
    ctx.fillRect(x + 19, y + 8, 7, 9);
    ctx.fillRect(x + 5, y, 4, 6);
    ctx.fillRect(x + 17, y, 4, 6);

    ctx.fillStyle = "#15132d";
    ctx.fillRect(x + 9, y + 9, 3, 3);
    ctx.fillRect(x + 15, y + 9, 3, 3);
  }
}


// ─── إصابة الكائنات والمؤثرات ───
function createHitEffect(enemy) {
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 * i) / 8;

    particles.push({
      x: enemy.x + enemy.width / 2,
      y: enemy.y + enemy.height / 2,
      vx: Math.cos(angle) * 2.5,
      vy: Math.sin(angle) * 2.5,
      life: 20,
      color: enemy.color
    });
  }
}

function checkHits() {
  for (let bulletIndex = bullets.length - 1; bulletIndex >= 0; bulletIndex--) {
    const bullet = bullets[bulletIndex];

    for (let enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex--) {
      const enemy = enemies[enemyIndex];

      const hit =
        bullet.x < enemy.x + enemy.width &&
        bullet.x + bullet.width > enemy.x &&
        bullet.y < enemy.y + enemy.height &&
        bullet.y + bullet.height > enemy.y;

      if (hit) {
        createHitEffect(enemy);
        playHitSound();

        bullets.splice(bulletIndex, 1);
        enemies.splice(enemyIndex, 1);
        score += 10;
        break;
      }
    }
  }
}

function drawParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];

    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.life--;

    ctx.globalAlpha = Math.max(0, particle.life / 20);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, 4, 4);

    if (particle.life <= 0) {
      particles.splice(i, 1);
    }
  }

  ctx.globalAlpha = 1;
}


// ─── حياة المركبة ونهاية اللعبة ───
function checkPlayerCollision(time) {
  if (time < invulnerableUntil) return;

  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];

    const touching =
      player.x + 7 < enemy.x + enemy.width &&
      player.x + player.width - 7 > enemy.x &&
      player.y + 7 < enemy.y + enemy.height &&
      player.y + player.height - 7 > enemy.y;

    if (touching) {
      enemies.splice(i, 1);
      lives--;
      invulnerableUntil = time + 1500;

      if (lives === 0) {
        gameOver = true;
        dragging = false;
      }

      break;
    }
  }
}

function restartGame() {
  score = 0;
  wave = 1;
  lives = 3;
  gameOver = false;
  invulnerableUntil = 0;
  lastShot = performance.now();
  lastDive = performance.now();
  dragging = false;

  bullets.length = 0;
  enemies.length = 0;
  particles.length = 0;

  player.x = canvas.width / 2 - player.width / 2;
  player.y = canvas.height - 75;
  player.targetX = player.x;
  player.targetY = player.y;

  createEnemies();
}


// ─── الخلفية والنصوص ───
function drawStars() {
  for (const star of stars) {
    star.y += star.speed;

    if (star.y > canvas.height) {
      star.y = 0;
      star.x = Math.random() * canvas.width;
    }

    ctx.fillStyle = "rgba(225, 231, 255, 0.7)";
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
}

function drawScore() {
  ctx.fillStyle = "#e8e9ff";
  ctx.font = "18px Arial";
  ctx.fillText(`SCORE  ${score}`, 15, 28);
  ctx.fillText(`LIVES  ${lives}`, canvas.width - 100, 28);
}

function drawGameOver() {
  ctx.fillStyle = "rgba(5, 7, 19, 0.8)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.fillStyle = "#f29ac2";
  ctx.font = "bold 38px Arial";
  ctx.fillText("GAME OVER", canvas.width / 2, 275);

  ctx.fillStyle = "#e8e9ff";
  ctx.font = "18px Arial";
  ctx.fillText(`SCORE: ${score}`, canvas.width / 2, 315);
  ctx.fillText("Click to play again", canvas.width / 2, 355);
  ctx.textAlign = "left";
}


// ─── حلقة اللعبة ───
function gameLoop(time) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawStars();

  if (!gameOver) {
    updatePlayer();
    shoot(time);
    updateBullets();
    updateEnemies(time);
    checkHits();
    checkPlayerCollision(time);

    if (enemies.length === 0 && !gameOver) {
      wave++;
      createEnemies();
    }
  }

  drawEnemies();
  drawBullets();
  drawParticles();

  // تومض المركبة قليلًا بعد الإصابة
  if (time >= invulnerableUntil || Math.floor(time / 100) % 2 === 0) {
    drawPlayer();
  }

  drawScore();

  if (gameOver) {
    drawGameOver();
  }

  requestAnimationFrame(gameLoop);
}

createEnemies();
requestAnimationFrame(gameLoop);