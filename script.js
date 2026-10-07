const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Elementos da HUD
const scoreElement = document.getElementById("score");
const upgradeElement = document.getElementById("upgrade");
const hpBar = document.getElementById("hp-bar");

// Estado do Jogador
const player = {
    x: canvas.width / 2 - 20,
    y: canvas.height - 60,
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

// Controles de entrada
let keys = {};
document.addEventListener("keydown", e => keys[e.code] = true);
document.addEventListener("keyup", e => keys[e.code] = false);

// Criar estrelas de fundo para dar efeito de movimento no espaço
for (let i = 0; i < 40; i++) {
    stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2,
        speed: Math.random() * 2 + 1
    });
}

// Temporizadores para geração de tiros e inimigos
let lastShotTime = 0;
let shotInterval = 300; // milissegundos entre tiros
let lastEnemyTime = 0;
let enemyInterval = 1000; // milissegundos entre novos inimigos

// Criar uma explosão de partículas
function createExplosion(x, y, color) {
    for (let i = 0; i < 10; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            radius: Math.random() * 3 + 1,
            alpha: 1,
            color: color
        });
    }
}

// Loop Principal do Jogo
function loop(timestamp) {
    update(timestamp);
    draw();
    requestAnimationFrame(loop);
}

function update(timestamp) {
    if (player.hp <= 0) return; // Se morreu, congela o update

    // 1. Mover o Jogador (Setas ou A/D)
    if (keys["ArrowLeft"] || keys["KeyA"]) {
        player.x -= player.speed;
    }
    if (keys["ArrowRight"] || keys["KeyD"]) {
        player.x += player.speed;
    }
    // Limitar bordas da tela
    if (player.x < 0) player.x = 0;
    if (player.x > canvas.width - player.width) player.x = canvas.width - player.width;

    // 2. Tiro Automático baseado no Nível da Arma
    if (timestamp - lastShotTime > shotInterval) {
        if (player.weaponLevel === 1) {
            bullets.push({ x: player.x + player.width / 2 - 3, y: player.y, vx: 0, vy: -8 });
        } else if (player.weaponLevel === 2) {
            bullets.push({ x: player.x + 5, y: player.y + 10, vx: 0, vy: -8 });
            bullets.push({ x: player.x + player.width - 10, y: player.y + 10, vx: 0, vy: -8 });
        } else {
            bullets.push({ x: player.x + player.width / 2 - 3, y: player.y, vx: 0, vy: -9 });
            bullets.push({ x: player.x + 2, y: player.y + 10, vx: -2, vy: -8 });
            bullets.push({ x: player.x + player.width - 8, y: player.y + 10, vx: 2, vy: -8 });
        }
        lastShotTime = timestamp;
    }

    // 3. Atualizar Tiros
    bullets.forEach((b, i) => {
        b.x += b.vx;
        b.y += b.vy;
        if (b.y < -10 || b.x < -10 || b.x > canvas.width + 10) bullets.splice(i, 1);
    });

    // 4. Gerar Inimigos automaticamente
    if (timestamp - lastEnemyTime > enemyInterval) {
        let size = Math.random() * 20 + 25; // tamanho variado
        let hp = size > 35 ? 3 : 1; // inimigos maiores aguentam mais tiros
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
        // Acelera a geração de inimigos conforme os pontos aumentam
        enemyInterval = Math.max(400, 1000 - Math.floor(player.score / 5) * 30);
    }

    // 5. Atualizar Inimigos
    enemies.forEach((e, i) => {
        e.y += e.speed;

        // Passou direto pela tela (perde 5 de vida)
        if (e.y > canvas.height) {
            enemies.splice(i, 1);
            player.hp = Math.max(0, player.hp - 5);
            hpBar.style.width = `${player.hp}%`;
            return;
        }

        // Colisão do Inimigo com a Nave do Jogador
        if (e.x < player.x + player.width &&
            e.x + e.width > player.x &&
            e.y < player.y + player.height &&
            e.y + e.height > player.y) {
            
            createExplosion(e.x + e.width/2, e.y + e.height/2, "#ff3333");
            enemies.splice(i, 1);
            player.hp = Math.max(0, player.hp - 20); // Dano pesado por colisão
            hpBar.style.width = `${player.hp}%`;
        }
    });

    // 6. Sistema de Colisão: Tiros vs Inimigos
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

                    // Sistema de upgrades baseados em score
                    if (player.score >= 100 && player.score < 250 && player.weaponLevel === 1) {
                        player.weaponLevel = 2;
                        upgradeElement.innerText = "ARMA: NÍVEL 2 (DUPLA)";
                        upgradeElement.style.color = "#00ff88";
                    } else if (player.score >= 250 && player.weaponLevel === 2) {
                        player.weaponLevel = 3;
                        upgradeElement.innerText = "ARMA: NÍVEL MÁXIMO (RAIO TRIPLO)";
                        upgradeElement.style.color = "#ff00e1";
                    }
                }
            }
        });
    });

    // 7. Atualizar Estrelas de Fundo
    stars.forEach(s => {
        s.y += s.speed;
        if (s.y > canvas.height) {
            s.y = 0;
            s.x = Math.random() * canvas.width;
        }
    });

    // 8. Atualizar Partículas das Explosões
    particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.03;
        if (p.alpha <= 0) particles.splice(i, 1);
    });
}

function draw() {
    ctx.fillStyle = "rgba(2, 2, 8, 0.3)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 1. Desenhar Estrelas
    ctx.fillStyle = "#ffffff";
    stars.forEach(s => {
        ctx.fillRect(s.x, s.y, s.size, s.size);
    });

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

    // 2. Desenhar Jogador
    ctx.fillStyle = "#00e5ff";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#00e5ff";
    ctx.beginPath();
    ctx.moveTo(player.x + player.width / 2, player.y);
    ctx.lineTo(player.x + player.width, player.y + player.height);
    ctx.lineTo(player.x + player.width - 8, player.y + player.height - 5);
    ctx.lineTo(player.x + 8, player.y + player.height - 5);
    ctx.lineTo(player.x, player.y + player.height);
    ctx.closePath();
    ctx.fill();

    // 3. Desenhar Tiros
    ctx.fillStyle = player.weaponLevel === 3 ? "#ff00e1" : "#00ff88";
    ctx.shadowColor = ctx.fillStyle;
    bullets.forEach(b => {
        ctx.fillRect(b.x, b.y, 6, 12);
    });

    // 4. Desenhar Inimigos
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

    // 5. Desenhar Partículas
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

// Inicia o loop
requestAnimationFrame(loop);
