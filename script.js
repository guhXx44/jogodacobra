const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Elementos da HUD
const scoreElement = document.getElementById("score");
const upgradeElement = document.getElementById("upgrade");
const hpBar = document.getElementById("hp-bar");

// Estado do Jogador
const player = {
    x: canvas.width / 2 - 20,
    y: canvas.height - 80,
    width: 40,
    height: 35,
    speed: 6,
    hp: 100,
    maxHp: 100,
    weaponLevel: 1,
    score: 0
};

// Listas de entidades
let bullets = [];
let enemies = [];
let particles = [];
let stars = [];
let powerups = [];

// Controles de entrada
let keys = {};
document.addEventListener("keydown", e => keys[e.code] = true);
document.addEventListener("keyup", e => keys[e.code] = false);

// Criar estrelas de fundo
for (let i = 0; i < 40; i++) {
    stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2,
        speed: Math.random() * 2 + 1
    });
}

// Temporizadores
let lastShotTime = 0;
let shotInterval = 250; 
let lastEnemyTime = 0;
let enemyInterval = 1000; 

// Criar uma explosão de partículas
function createExplosion(x, y, color) {
    for (let i = 0; i < 12; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 7,
            vy: (Math.random() - 0.5) * 7,
            radius: Math.random() * 3 + 1,
            alpha: 1,
            color: color
        });
    }
}

// Loop Principal
function loop(timestamp) {
    update(timestamp);
    draw();
    requestAnimationFrame(loop);
}

function update(timestamp) {
    if (player.hp <= 0) return;

    // 1. Mover o Jogador em 4 Direções (Frente, Trás, Esquerda, Direita)
    if (keys["ArrowLeft"] || keys["KeyA"])  player.x -= player.speed;
    if (keys["ArrowRight"] || keys["KeyD"]) player.x += player.speed;
    if (keys["ArrowUp"] || keys["KeyW"])    player.y -= player.speed;
    if (keys["ArrowDown"] || keys["KeyS"])  player.y += player.speed;

    // Limitar bordas da tela (Horizontal e Vertical)
    if (player.x < 0) player.x = 0;
    if (player.x > canvas.width - player.width) player.x = canvas.width - player.width;
    if (player.y < 0) player.y = 0;
    if (player.y > canvas.height - player.height) player.y = canvas.height - player.height;

    // 2. Tiro Automático
    if (timestamp - lastShotTime > shotInterval) {
        if (player.weaponLevel === 1) {
            bullets.push({ x: player.x + player.width / 2 - 3, y: player.y, vx: 0, vy: -9 });
        } else if (player.weaponLevel === 2) {
            bullets.push({ x: player.x + 4, y: player.y + 10, vx: 0, vy: -9 });
            bullets.push({ x: player.x + player.width - 10, y: player.y + 10, vx: 0, vy: -9 });
        } else {
            bullets.push({ x: player.x + player.width / 2 - 3, y: player.y, vx: 0, vy: -10 });
            bullets.push({ x: player.x + 2, y: player.y + 10, vx: -2, vy: -9 });
            bullets.push({ x: player.x + player.width - 8, y: player.y + 10, vx: 2, vy: -9 });
        }
        lastShotTime = timestamp;
    }

    // 3. Atualizar Tiros
    bullets.forEach((b, i) => {
        b.x += b.vx;
        b.y += b.vy;
        if (b.y < -10 || b.x < -10 || b.x > canvas.width + 10) bullets.splice(i, 1);
    });

    // 4. Gerar Inimigos
    if (timestamp - lastEnemyTime > enemyInterval) {
        let size = Math.random() * 20 + 25;
        let hp = size > 35 ? 3 : 1;
        enemies.push({
            x: Math.random() * (canvas.width - size),
            y: -size,
            width: size,
            height: size,
            speed: Math.random() * 1.5 + 2,
            hp: hp,
            maxHp: hp,
            color: size > 35 ? "#ff3333" : "#ffaa00"
        });
        lastEnemyTime = timestamp;
        enemyInterval = Math.max(350, 1000 - Math.floor(player.score / 5) * 25);
    }

    // 5. Atualizar Inimigos
    enemies.forEach((e, i) => {
        e.y += e.speed;

        if (e.y > canvas.height) {
            enemies.splice(i, 1);
            player.hp = Math.max(0, player.hp - 5);
            hpBar.style.width = `${player.hp}%`;
            return;
        }

        // Colisão com o jogador
        if (e.x < player.x + player.width &&
            e.x + e.width > player.x &&
            e.y < player.y + player.height &&
            e.y + e.height > player.y) {
            
            createExplosion(e.x + e.width/2, e.y + e.height/2, "#ff3333");
            enemies.splice(i, 1);
            player.hp = Math.max(0, player.hp - 20);
            hpBar.style.width = `${player.hp}%`;
        }
    });

    // 6. Atualizar Power-ups
    powerups.forEach((p, i) => {
        p.y += p.speed;

        // Se passar direto, some
        if (p.y > canvas.height) {
            powerups.splice(i, 1);
            return;
        }

        // Colisão do Jogador com o Power-up
        if (p.x - p.radius < player.x + player.width &&
            p.x + p.radius > player.x &&
            p.y - p.radius < player.y + player.height &&
            p.y + p.radius > player.y) {
            
            createExplosion(p.x, p.y, p.color);
            
            if (p.type === "SHIELD") {
                player.hp = Math.min(player.maxHp, player.hp + 35); // Cura vida
                hpBar.style.width = `${player.hp}%`;
            } else if (p.type === "WEAPON") {
                if (player.weaponLevel < 3) {
                    player.weaponLevel++;
                    updateWeaponText();
                }
            }
            
            powerups.splice(i, 1);
        }
    });

    // 7. Colisão: Tiros vs Inimigos
    bullets.forEach((b, bi) => {
        enemies.forEach((e, ei) => {
            if (b.x < e.x + e.width &&
                b.x + 6 > e.x &&
                b.y < e.y + e.height &&
                b.y + 12 > e.y) {
                
                bullets.splice(bi, 1);
                e.hp--;

                if (e.hp <= 0) {
                    createExplosion(e.x + e.width / 2, e.y + e.height / 2, e.color);
                    enemies.splice(ei, 1);
                    player.score += 10;
                    scoreElement.innerText = player.score;

                    // Chance de 20% de dropar um Power-up ao destruir um inimigo
                    if (Math.random() < 0.20) {
                        let type = Math.random() < 0.6 ? "SHIELD" : "WEAPON"; // 60% chance escudo, 40% arma
                        powerups.push({
                            x: e.x + e.width / 2,
                            y: e.y + e.height / 2,
                            radius: 10,
                            speed: 2,
                            type: type,
                            color: type === "SHIELD" ? "#00ff88" : "#ffeb3b"
                        });
                    }
                }
            }
        });
    });

    // 8. Atualizar Estrelas de Fundo
    stars.forEach(s => {
        s.y += s.speed;
        if (s.y > canvas.height) {
            s.y = 0;
            s.x = Math.random() * canvas.width;
        }
    });

    // 9. Atualizar Partículas
    particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.03;
        if (p.alpha <= 0) particles.splice(i, 1);
    });
}

function updateWeaponText() {
    if (player.weaponLevel === 2) {
        upgradeElement.innerText = "ARMA: NÍVEL 2 (DUPLA)";
        upgradeElement.style.color = "#00ff88";
    } else if (player.weaponLevel === 3) {
        upgradeElement.innerText = "ARMA: NÍVEL MÁXIMO (RAIO TRIPLO)";
        upgradeElement.style.color = "#ff00e1";
    }
}

function draw() {
    ctx.fillStyle = "rgba(2, 2, 8, 0.3)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 1. Estrelas
    ctx.fillStyle = "#ffffff";
    stars.forEach(s => {
        ctx.fillRect(s.x, s.y, s.size, s.size);
    });

    // Game Over
    if (player.hp <= 0) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = "#ff3366";
        ctx.font = "bold 32px 'Segoe UI'";
        ctx.textAlign = "center";
        ctx.fillText("FIM DE JOGO", canvas.width / 2, canvas.height / 2 - 20);
        
        ctx.fillStyle = "#fff";
        ctx.font = "18px 'Segoe UI'";
        ctx.fillText(`Pontuação Final: ${player.score}`, canvas.width / 2, canvas.height / 2 + 20);
        ctx.fillText("Atualize a página (F5) para Recomeçar", canvas.width / 2, canvas.height / 2 + 60);
        return;
    }

    // 2. Desenhar Power-ups (Orbes Neon Flutuantes)
    powerups.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // Letra interna no Orbe identificando o item
        ctx.fillStyle = "#000";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.type === "SHIELD" ? "H" : "W", p.x, p.y);
    });

    // 3. Desenhar Jogador
    ctx.fillStyle = "#00e5ff";
    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(player.x + player.width / 2, player.y);
    ctx.lineTo(player.x + player.width, player.y + player.height);
    ctx.lineTo(player.x + player.width - 8, player.y + player.height - 5);
    ctx.lineTo(player.x + 8, player.y + player.height - 5);
    ctx.lineTo(player.x, player.y + player.height);
    ctx.closePath();
    ctx.fill();

    // 4. Desenhar Tiros
    ctx.fillStyle = player.weaponLevel === 3 ? "#ff00e1" : "#00ff88";
    ctx.shadowColor = ctx.fillStyle;
    bullets.forEach(b => {
        ctx.fillRect(b.x, b.y, 6, 12);
    });

    // 5. Desenhar Inimigos
    enemies.forEach(e => {
        ctx.fillStyle = e.color;
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 8;
        
        ctx.beginPath();
ctx.moveTo(e.x + e.width / 2, e.y + e.height);
ctx.lineTo(e.x + e.width, e.y);
ctx.lineTo(e.x, e.y);
ctx.closePath();
ctx.fill();
if (e.maxHp > 1 && e.hp < e.maxHp) {
ctx.fillStyle = "#333";
ctx.fillRect(e.x, e.y - 8, e.width, 4);
ctx.fillStyle = "#ff0000";
ctx.fillRect(e.x, e.y - 8, e.width * (e.hp / e.maxHp), 4);
}
});
ctx.shadowBlur = 0;
// 6. Desenhar Partículas
particles.forEach(p => {
ctx.save();
ctx.globalAlpha = p.alpha;
ctx.fillStyle = p.color;
ctx.beginPath();
ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
ctx.fill();
ctx.restore();
});
}
