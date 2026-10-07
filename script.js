const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const weapon = document.getElementById("weapon");

// Elementos da HUD instalados via script
const screenWrapper = document.querySelector(".screen-wrapper");
const damageFlash = document.createElement("div");
damageFlash.className = "damage-flash";
screenWrapper.appendChild(damageFlash);

const hudPanel = document.createElement("div");
hudPanel.className = "hud-panel";
hudPanel.innerHTML = `
    <div class="hud-stat"><div class="hud-label">SAÚDE</div><div id="hud-hp" class="hud-value">100%</div></div>
    <div class="hud-stat"><div class="hud-label">MUNIÇÃO</div><div id="hud-ammo" class="hud-value">8/8</div></div>
    <div class="hud-stat"><div class="hud-label">ABATES</div><div id="hud-kills" class="hud-value">0</div></div>
`;
document.querySelector(".game-container").insertBefore(hudPanel, document.querySelector(".controls-hint"));

const hudHp = document.getElementById("hud-hp");
const hudAmmo = document.getElementById("hud-ammo");
const hudKills = document.getElementById("hud-kills");

// CONFIGURAÇÕES DO MAPA MATRIZ (1 = Parede, 0 = Espaço Vazio)
const mapWidth = 12;
const mapHeight = 12;
const map = [
    1,1,1,1,1,1,1,1,1,1,1,1,
    1,0,0,0,0,0,1,0,0,0,0,1,
    1,0,1,1,0,0,1,0,1,1,0,1,
    1,0,1,0,0,0,0,0,0,1,0,1,
    1,0,0,0,0,1,1,0,0,0,0,1,
    1,1,1,0,0,1,1,0,0,1,1,1,
    1,0,0,0,0,0,0,0,0,0,0,1,
    1,0,1,1,1,0,0,1,1,1,0,1,
    1,0,1,0,0,0,0,0,0,1,0,1,
    1,0,1,0,1,1,1,1,0,1,0,1,
    1,0,0,0,0,0,0,0,0,0,0,1,
    1,1,1,1,1,1,1,1,1,1,1,1
];

// Estado do Jogador
let player = {
    x: 2.5,
    y: 2.5,
    angle: 0,
    hp: 100,
    maxAmmo: 8,
    ammo: 8,
    kills: 0,
    isReloading: false
};

// Configurações do Sistema de Raios 3D
const FOV = Math.PI / 3; 
const halfFOV = FOV / 2;
const numRays = canvas.width;
const deltaAngle = FOV / numRays;
const renderDistance = 14;

// Guardar as distâncias das paredes por coluna de pixel para renderizar os monstros corretamente atrás delas
let zBuffer = new Array(canvas.width);

// Lista de Monstros Ativos (Inimigos)
let enemies = [
    { x: 5.5, y: 3.5, hp: 2, speed: 0.02, radius: 0.2 },
    { x: 9.5, y: 6.5, hp: 2, speed: 0.02, radius: 0.2 },
    { x: 2.5, y: 9.5, hp: 2, speed: 0.02, radius: 0.2 },
    { x: 9.5, y: 9.5, hp: 2, speed: 0.03, radius: 0.2 }
];

// Controles
const moveSpeed = 0.05;
const rotSpeed = 0.035;
let keys = {};
document.addEventListener("keydown", e => keys[e.code] = true);
document.addEventListener("keyup", e => keys[e.code] = false);

// Ação de Atirar com verificação de Munição e Recarga
document.addEventListener("mousedown", () => {
    if (player.hp <= 0 || player.isReloading) return;

    if (player.ammo <= 0) {
        reloadWeapon();
        return;
    }

    if (!weapon.classList.contains("shoot-animation")) {
        weapon.classList.add("shoot-animation");
        player.ammo--;
        updateHUD();
        
        setTimeout(() => weapon.classList.remove("shoot-animation"), 150);
        
        // Muzzle Flash na tela
        ctx.fillStyle = "rgba(255, 200, 0, 0.2)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Lógica de Acerto: Verifica se há um monstro bem na mira central (ângulo da mira)
        shootRayCast();
    }
});

function reloadWeapon() {
    player.isReloading = true;
    hudAmmo.innerText = "RECARGANDO...";
    hudAmmo.className = "hud-value low";
    
    setTimeout(() => {
        player.ammo = player.maxAmmo;
        player.isReloading = false;
        hudAmmo.className = "hud-value";
        updateHUD();
    }, 1200); // 1.2 segundos para recarregar
}

function triggerDamageFlash() {
    damageFlash.style.opacity = "1";
    setTimeout(() => damageFlash.style.opacity = "0", 80);
}

function updateHUD() {
    hudHp.innerText = `${player.hp}%`;
    hudHp.className = player.hp <= 30 ? "hud-value low" : "hud-value";
    
    if (!player.isReloading) {
        hudAmmo.innerText = `${player.ammo}/${player.maxAmmo}`;
        hudAmmo.className = player.ammo === 0 ? "hud-value low" : "hud-value";
    }
    hudKills.innerText = player.kills;
}

// Lógica de Raycast para detectar tiros certeiros no meio da tela
function shootRayCast() {
    let rayAngle = player.angle;
    let distance = 0;
    let hitEnemy = null;

    let eyeX = Math.cos(rayAngle);
    let eyeY = Math.sin(rayAngle);

    // Projetando uma linha invisível direto do centro da arma para frente
    while (distance < renderDistance) {
        distance += 0.1;
        let testX = player.x + eyeX * distance;
        let testY = player.y + eyeY * distance;

        // Se bater numa parede antes, o tiro para
        if (map[Math.floor(testY) * mapWidth + Math.floor(testX)] === 1) break;

        // Checar colisão linear com cada monstro vivo
        for (let i = 0; i < enemies.length; i++) {
            let e = enemies[i];
            let distToEnemy = Math.sqrt((testX - e.x)**2 + (testY - e.y)**2);
            if (distToEnemy < e.radius) {
                hitEnemy = i;
                break;
            }
        }
        if (hitEnemy !== null) break;
    }

    // Se acertou, causa dano
    if (hitEnemy !== null) {
        let target = enemies[hitEnemy];
        target.hp--;
        
        // Efeito de impacto rápido piscando a tela de verde na mira
        ctx.fillStyle = "rgba(0, 255, 0, 0.3)";
        ctx.fillRect(canvas.width / 2 - 20, canvas.height / 2 - 20, 40, 40);

        if (target.hp <= 0) {
            enemies.splice(hitEnemy, 1);
            player.kills++;
            updateHUD();
            
            // Se vencer todos, novos surgem aleatoriamente para continuar o looping infinito
            if (enemies.length === 0) spawnWave();
        }
    }
}

function spawnWave() {
    for (let i = 0; i < 4; i++) {
        let rx, ry;
        do {
            rx = Math.floor(Math.random() * (mapWidth - 2)) + 1;
            ry = Math.floor(Math.random() * (mapHeight - 2)) + 1;
        } while (map[ry * mapWidth + rx] === 1 || (Math.abs(rx - player.x) < 2 && Math.abs(ry - player.y) < 2));
        
        enemies.push({ x: rx + 0.5, y: ry + 0.5, hp: 2, speed: 0.02 + (player.kills * 0.002), radius: 0.2 });
    }
}

// Atualização de movimentação e IA dos monstros
function update() {
    if (player.hp <= 0) return;

    let newX = player.x;
    let newY = player.y;

    if (keys["KeyW"] || keys["ArrowUp"]) {
        newX += Math.cos(player.angle) * moveSpeed;
        newY += Math.sin(player.angle) * moveSpeed;
    }
    if (keys["KeyS"] || keys["ArrowDown"]) {
        newX -= Math.cos(player.angle) * moveSpeed;
        newY -= Math.sin(player.angle) * moveSpeed;
    }
    if (keys["KeyA"] || keys["ArrowLeft"])  player.angle -= rotSpeed;
    if (keys["KeyD"] || keys["ArrowRight"]) player.angle += rotSpeed;

    // Colisões simples nas paredes do labirinto
    if (map[Math.floor(player.y) * mapWidth + Math.floor(newX)] === 0) player.x = newX;
    if (map[Math.floor(newY) * mapWidth + Math.floor(player.x)] === 0) player.y = newY;

    // IA dos Monstros: Perseguir o jogador matematicamente
    enemies.forEach(e => {
        let dx = player.x - e.x;
        let dy = player.y - e.y;
        let dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0.3) {
            // Anda em linha reta em direção ao seu X e Y
            e.x += (dx / dist) * e.speed;
            e.y += (dy / dist) * e.speed;
        } else {
            // Se encostar no jogador, morde e dá dano!
            player.hp = Math.max(0, player.hp - 1);
            updateHUD();
            triggerDamageFlash();
        }
    });
}

// Renderizador da Perspectiva 3D
function draw() {
    // Teto e Chão
    ctx.fillStyle = "#111115";
    ctx.fillRect(0, 0, canvas.width, canvas.height / 2);
    ctx.fillStyle = "#221a15";
    ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);

    // 1. LANÇAR RAIOS PARA AS PAREDES E ALIMENTAR O Z-BUFFER
    let startAngle = player.angle - halfFOV;

    for (let i = 0; i < numRays; i++) {
        let rayAngle = startAngle + i * deltaAngle;
        let distance = 0;
        let hitWall = false;

        let eyeX = Math.cos(rayAngle);
        let eyeY = Math.sin(rayAngle);

        while (!hitWall && distance < renderDistance) {
            distance += 0.04;
            let testX = Math.floor(player.x + eyeX * distance);
            let testY = Math.floor(player.y + eyeY * distance);

            if (testX < 0 || testX >= mapWidth || testY < 0 || testY >= mapHeight) {
                hitWall = true;
                distance = renderDistance;
            } else if (map[testY * mapWidth + testX] === 1) {
                hitWall = true;
            }
        }

        let correctedDistance = distance * Math.cos(rayAngle - player.angle);
        if (correctedDistance < 0.1) correctedDistance = 0.1;

        // Guarda a distância dessa coluna para os monstros saberem se ficam escondidos atrás da parede
        zBuffer[i] = correctedDistance;

        let wallHeight = Math.min(canvas.height, (canvas.height / correctedDistance));
        let shade = Math.max(0, 200 - (correctedDistance * 15));
        
        ctx.strokeStyle = `rgb(${shade}, 0, 0)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(i, (canvas.height - wallHeight) / 2);
        ctx.lineTo(i, (canvas.height + wallHeight) / 2);
        ctx.stroke();
    }

    // 2. PROJEÇÃO DOS MONSTROS 3D (Cálculo Matricial de Sprites)
    enemies.forEach(e => {
        let ex = e.x - player.x;
        let ey = e.y - player.y;

        // Transformação trigonométrica usando a rotação do jogador
        let spriteX = ex * Math.sin(player.angle) - ey * Math.cos(player.angle);
        let spriteY = ex * Math.cos(player.angle) + ey * Math.sin(player.angle);

        // Se o inimigo estiver atrás da câmera, ignora a renderização
        if (spriteY <= 0.1) return;

        // Encontrar a coluna central dele na tela
let spriteScreenX = parseInt((canvas.width / 2) * (1 + spriteX / spriteY));
// Escala o tamanho do monstro dependendo de quão perto ele está (Proporcional a 1 / Distância)
let spriteSize = Math.abs(parseInt(canvas.height / spriteY));
if (spriteSize > canvas.height * 2) spriteSize = canvas.height * 2;
let drawStartX = spriteScreenX - spriteSize / 2;
let drawEndX = spriteScreenX + spriteSize / 2;
let drawStartY = (canvas.height - spriteSize) / 2;
// Desenhar o monstro coluna por coluna de pixel, verificando o Z-Buffer das paredes
for (let stripe = drawStartX; stripe < drawEndX; stripe++) {
if (stripe >= 0 && stripe < canvas.width && spriteY < zBuffer[stripe]) {
// Desenha uma linha vertical amarela representando a silhueta alienígena do monstro
ctx.strokeStyle = "#ffcc00";
ctx.lineWidth = 1;
ctx.beginPath();
ctx.moveTo(stripe, drawStartY);
ctx.lineTo(stripe, drawStartY + spriteSize);
ctx.stroke();
// Detalhe interno do monstro (Os Olhos vermelhos brilhantes no meio do corpo)
ctx.strokeStyle = "#ff0000";
ctx.beginPath();
ctx.moveTo(stripe, drawStartY + spriteSize/2.5);
ctx.lineTo(stripe, drawStartY + spriteSize/2.2);
ctx.stroke();
}
}
});
// 3. MINIMAPA 2D NO CANTO
const minMapScale = 5;
for (let y = 0; y < mapHeight; y++) {
for (let x = 0; x < mapWidth; x++) {
if (map[y * mapWidth + x] === 1) {
ctx.fillStyle = "#440000";
ctx.fillRect(x * minMapScale + 10, y * minMapScale + 10, minMapScale, minMapScale);
}
}
}
// Desenhar monstros como pontos amarelos no mapa tático
ctx.fillStyle = "#ffcc00";
enemies.forEach(e => {
ctx.fillRect(e.x * minMapScale + 10, e.y * minMapScale + 10, 2, 2);
});
// Jogador no mapa (Verde)
ctx.fillStyle = "#00ff00";
ctx.fillRect(player.x * minMapScale + 10, player.y * minMapScale + 10, 3, 3);
// Tela de Morte
if (player.hp <= 0) {
ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = "#ff0000";
ctx.font = "bold 36px 'Courier New'";
ctx.textAlign = "center";
ctx.fillText("VOCÊ MORREU", canvas.width / 2, canvas.height / 2 - 10);
ctx.fillStyle = "#fff";
ctx.font = "16px 'Courier New'";
ctx.fillText(Abates confirmados: ${player.kills}, canvas.width / 2, canvas.height / 2 + 30);
ctx.fillText("Pressione F5 para reabastecer e tentar de novo", canvas.width / 2, canvas.height / 2 + 60);
}
}
function gameLoop() {
update();
draw();
requestAnimationFrame(gameLoop);
}
// Inicialização da HUD inicial
updateHUD();
gameLoop();
