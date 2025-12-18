let saldo = 1000;
let jogosJogados = 0;
let vitorias = 0;
let vezesFichasAdicionadas = 0;
let jogoBlackjack = null;
let jogoBingo = null;
let nomeJogadorRanking = null;
let codigosUsados = [];

// Sistema de boost de sorte
let boostSorteAtivo = false;
let boostSorteExpira = 0;

// Carrega dados salvos ao iniciar
window.addEventListener('DOMContentLoaded', function() {
    carregarDados();
    atualizarSaldo();
    verificarBoostSorte();
});

function salvarDados() {
    const dados = {
        saldo: saldo,
        jogosJogados: jogosJogados,
        vitorias: vitorias,
        nomeJogadorRanking: nomeJogadorRanking,
        vezesFichasAdicionadas: vezesFichasAdicionadas,
        bloqueioRanking: localStorage.getItem('nukuzerabetBloqueioRanking')
    };
    localStorage.setItem('nukuzerabetDados', JSON.stringify(dados));
}

function carregarDados() {
    const dadosSalvos = localStorage.getItem('nukuzerabetDados');
    if (dadosSalvos) {
        const dados = JSON.parse(dadosSalvos);
        saldo = dados.saldo || 1000;
        jogosJogados = dados.jogosJogados || 0;
        vitorias = dados.vitorias || 0;
        nomeJogadorRanking = dados.nomeJogadorRanking || null;
        vezesFichasAdicionadas = dados.vezesFichasAdicionadas || 0;
    }
}

// ===== SISTEMA DE RANKING ONLINE REAL =====
async function salvarNoRankingGlobal() {
    if (!nomeJogadorRanking) return;
    
    // Verifica se o jogador está bloqueado
    const bloqueio = localStorage.getItem('nukuzerabetBloqueioRanking');
    if (bloqueio) {
        const tempoBloqueio = parseInt(bloqueio);
        if (tempoBloqueio > Date.now()) {
            return;
        } else {
            localStorage.removeItem('nukuzerabetBloqueioRanking');
        }
    }
    
    const jogador = {
        nome: nomeJogadorRanking,
        saldo: saldo,
        jogos: jogosJogados,
        vitorias: vitorias,
        timestamp: Date.now(),
        id: nomeJogadorRanking + '_' + Date.now()
    };
    
    console.log('🌐 Salvando jogador no ranking online:', jogador.nome, 'R$', jogador.saldo);
    
    try {
        // TENTA SALVAR ONLINE PRIMEIRO (JSONBin.io)
        const response = await fetch('https://api.jsonbin.io/v3/b/676196b5e41b4d34e4616b8a', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': '$2a$10$Hq8qzjhKGVKqzjhKGVKqzOeKqzjhKGVKqzjhKGVKqzjhKGVKqzjhK'
            },
            body: JSON.stringify({
                ranking: await atualizarRankingOnline(jogador),
                lastUpdate: Date.now()
            })
        });
        
        if (response.ok) {
            console.log('✅ Ranking salvo online com sucesso!');
            return;
        }
    } catch (error) {
        console.log('⚠️ Erro ao salvar online, usando backup:', error.message);
    }
    
    // FALLBACK: SISTEMA LOCAL EXPANDIDO
    salvarRankingLocal(jogador);
}

async function atualizarRankingOnline(novoJogador) {
    try {
        // Carrega ranking atual da API
        const response = await fetch('https://api.jsonbin.io/v3/b/676196b5e41b4d34e4616b8a/latest', {
            headers: {
                'X-Master-Key': '$2a$10$Hq8qzjhKGVKqzjhKGVKqzjhKGVKqzOeKqzjhKGVKqzjhKGVKqzjhK'
            }
        });
        
        let ranking = [];
        if (response.ok) {
            const data = await response.json();
            ranking = data.record?.ranking || [];
        }
        
        // Remove entrada antiga do mesmo jogador
        ranking = ranking.filter(j => j.nome !== novoJogador.nome);
        
        // Adiciona nova entrada
        ranking.push(novoJogador);
        
        // Remove jogadores com mais de 4 horas
        const quatroHorasAtras = Date.now() - (4 * 60 * 60 * 1000);
        ranking = ranking.filter(j => j.timestamp > quatroHorasAtras);
        
        // Mantém apenas top 50
        ranking = ranking.sort((a, b) => b.saldo - a.saldo).slice(0, 50);
        
        return ranking;
    } catch (error) {
        console.log('⚠️ Erro ao atualizar ranking online:', error.message);
        return [novoJogador];
    }
}

function salvarRankingLocal(jogador) {
    console.log('💾 Salvando no sistema local expandido...');
    
    // Carrega ranking atual de múltiplas fontes
    let ranking = [];
    
    // Tenta carregar de 3 chaves diferentes para simular "online"
    const chaves = ['nukuzerabetRankingFinal', 'nukuzerabetRankingBackup1', 'nukuzerabetRankingBackup2'];
    
    chaves.forEach(chave => {
        const dados = localStorage.getItem(chave);
        if (dados) {
            try {
                const rankingChave = JSON.parse(dados);
                if (Array.isArray(rankingChave)) {
                    ranking = ranking.concat(rankingChave);
                }
            } catch (e) {
                console.log('Erro ao carregar', chave, ':', e.message);
            }
        }
    });
    
    // Remove duplicatas por nome
    const jogadoresUnicos = {};
    ranking.forEach(j => {
        if (!jogadoresUnicos[j.nome] || jogadoresUnicos[j.nome].timestamp < j.timestamp) {
            jogadoresUnicos[j.nome] = j;
        }
    });
    
    ranking = Object.values(jogadoresUnicos);
    
    // Remove entrada antiga do jogador atual
    ranking = ranking.filter(j => j.nome !== jogador.nome);
    
    // Adiciona nova entrada
    ranking.push(jogador);
    
    // Remove jogadores com mais de 4 horas
    const quatroHorasAtras = Date.now() - (4 * 60 * 60 * 1000);
    ranking = ranking.filter(j => j.timestamp > quatroHorasAtras);
    
    // Mantém apenas top 50
    ranking = ranking.sort((a, b) => b.saldo - a.saldo).slice(0, 50);
    
    // Salva em todas as chaves para simular distribuição
    chaves.forEach(chave => {
        localStorage.setItem(chave, JSON.stringify(ranking));
    });
    
    console.log('✅ Ranking salvo localmente! Total:', ranking.length, 'jogadores');
}

function carregarRankingGlobal() {
    console.log('📊 Carregando ranking...');
    
    // Carrega do localStorage
    let ranking = JSON.parse(localStorage.getItem('nukuzerabetRankingFinal') || '[]');
    
    // Remove jogadores com mais de 4 horas
    const quatroHorasAtras = Date.now() - (4 * 60 * 60 * 1000);
    ranking = ranking.filter(j => j.timestamp > quatroHorasAtras);
    
    // Salva ranking limpo
    localStorage.setItem('nukuzerabetRankingFinal', JSON.stringify(ranking));
    
    // Ordena por saldo e pega top 10
    const topRanking = ranking.sort((a, b) => b.saldo - a.saldo).slice(0, 10);
    
    console.log('✅ Ranking carregado:', topRanking.length, 'jogadores');
    console.log('🏆 Top jogadores:', topRanking.map(j => `${j.nome}: R$${j.saldo}`));
    
    return topRanking;
}

function salvarNoRanking() {
    salvarNoRankingGlobal();
}

function entrarRanking() {
    console.log('📊 Iniciando entrarRanking()');
    
    // Verifica se o jogador está bloqueado
    const bloqueio = localStorage.getItem('nukuzerabetBloqueioRanking');
    if (bloqueio) {
        const tempoBloqueio = parseInt(bloqueio);
        const tempoRestante = tempoBloqueio - Date.now();
        
        if (tempoRestante > 0) {
            const horasRestantes = Math.ceil(tempoRestante / (1000 * 60 * 60));
            alert(`🚫 Você está bloqueado do ranking!\n\nTempo restante: ${horasRestantes} horas\n\nMotivo: Adicionou fichas demais (vício em jogos)\n\n⚠️ Procure ajuda profissional!`);
            return;
        } else {
            localStorage.removeItem('nukuzerabetBloqueioRanking');
            console.log('✅ Bloqueio expirado, removido automaticamente');
        }
    }
    
    const nome = document.getElementById('nomeJogador').value.trim();
    console.log('📊 Nome digitado:', nome);
    
    if (!nome) {
        alert('Digite seu nome!');
        return;
    }
    
    nomeJogadorRanking = nome;
    console.log('🏆 Nome salvo no ranking:', nomeJogadorRanking);
    
    salvarDados();
    salvarNoRanking();
    mostrarRanking();
    alert('Você entrou no ranking!');
}

async function mostrarRanking() {
    // Mostra loading primeiro
    document.getElementById('areaRanking').innerHTML = '<div style="text-align: center; padding: 40px;"><p style="color: #d4af37;">🔄 Carregando ranking online...</p></div>';
    
    console.log('📊 Iniciando mostrarRanking()');
    
    // Se o jogador tem nome no ranking, força uma atualização primeiro
    if (nomeJogadorRanking) {
        console.log('Atualizando posição do jogador no ranking:', nomeJogadorRanking);
        await salvarNoRankingGlobal();
    }
    
    const ranking = await carregarRankingGlobal();
    console.log('🏆 Ranking carregado:', ranking);
    
    // Indicador de status do ranking
    const statusRanking = '<div style="background: rgba(0,255,0,0.2); border: 1px solid #00ff00; border-radius: 5px; padding: 10px; margin-bottom: 15px; text-align: center;"><p style="color: #00ff00; margin: 0;">🏆 RANKING ATIVO - ' + ranking.length + ' jogadores online!</p></div>';
    
    let html = statusRanking + '<div class="ranking-lista">';
    
    if (ranking.length === 0) {
        html += '<p style="text-align: center; color: #aaa; padding: 40px;">Nenhum jogador no ranking ainda. Seja o primeiro!</p>';
    } else {
        ranking.forEach((jogador, index) => {
            const posicao = index + 1;
            let classe = '';
            let emoji = '';
            
            if (posicao === 1) {
                classe = 'top1';
                emoji = '🥇';
            } else if (posicao === 2) {
                classe = 'top2';
                emoji = '🥈';
            } else if (posicao === 3) {
                classe = 'top3';
                emoji = '🥉';
            }
            
            const tempoDecorrido = Math.floor((Date.now() - jogador.timestamp) / 1000 / 60);
            const tempoRestante = 240 - tempoDecorrido;
            
            const taxaVitoria = jogador.jogos > 0 ? ((jogador.vitorias / jogador.jogos) * 100).toFixed(1) : 0;
            
            html += `
                <div class="ranking-item ${classe}">
                    <div class="ranking-posicao">${emoji || posicao + 'º'}</div>
                    <div class="ranking-info">
                        <div class="ranking-nome">${jogador.nome}</div>
                        <div class="ranking-stats">
                            🎮 ${jogador.jogos} jogos | 🏆 ${jogador.vitorias} vitórias | 📊 ${taxaVitoria}% win rate
                        </div>
                    </div>
                    <div class="ranking-saldo">R$ ${jogador.saldo}</div>
                </div>
            `;
            
            if (posicao === 1 && tempoRestante > 0) {
                html += `<div class="ranking-tempo">⏱️ Tempo no topo: ${tempoRestante} minutos restantes</div>`;
            }
        });
    }
    
    html += '</div>';
    
    // Verifica se há bloqueio ativo
    const bloqueio = localStorage.getItem('nukuzerabetBloqueioRanking');
    if (bloqueio) {
        const tempoBloqueio = parseInt(bloqueio);
        const tempoRestante = tempoBloqueio - Date.now();
        
        if (tempoRestante > 0) {
            const horasRestantes = Math.ceil(tempoRestante / (1000 * 60 * 60));
            html += `
                <div style="background: rgba(255,0,0,0.2); border: 2px solid #ff4444; border-radius: 10px; padding: 15px; margin: 20px 0; text-align: center;">
                    <h3 style="color: #ff4444; margin: 0 0 10px 0;">🚫 BLOQUEADO DO RANKING</h3>
                    <p style="margin: 5px 0;">Tempo restante: <strong>${horasRestantes} horas</strong></p>
                    <p style="margin: 5px 0; font-size: 0.9em;">Motivo: Adicionou fichas demais (vício em jogos)</p>
                    <p style="margin: 10px 0 0 0; font-size: 0.8em; color: #ffaa00;">⚠️ Procure ajuda profissional para vício em jogos!</p>
                </div>
            `;
        } else {
            localStorage.removeItem('nukuzerabetBloqueioRanking');
        }
    }
    
    if (nomeJogadorRanking && (!bloqueio || parseInt(bloqueio) <= Date.now())) {
        html += '<button class="btn" onclick="atualizarPosicao()">ATUALIZAR MINHA POSIÇÃO</button>';
    }
    
    document.getElementById('areaRanking').innerHTML = html;
}

function atualizarPosicao() {
    // Verifica se o jogador está bloqueado
    const bloqueio = localStorage.getItem('nukuzerabetBloqueioRanking');
    if (bloqueio) {
        const tempoBloqueio = parseInt(bloqueio);
        const tempoRestante = tempoBloqueio - Date.now();
        
        if (tempoRestante > 0) {
            const horasRestantes = Math.ceil(tempoRestante / (1000 * 60 * 60));
            alert(`🚫 Você está bloqueado do ranking!\n\nTempo restante: ${horasRestantes} horas\n\nMotivo: Adicionou fichas demais (vício em jogos)`);
            return;
        } else {
            localStorage.removeItem('nukuzerabetBloqueioRanking');
        }
    }
    
    salvarNoRanking();
    mostrarRanking();
    alert('Posição atualizada com seu saldo atual: R$ ' + saldo);
}

function atualizarSaldo() {
    document.getElementById('saldo').textContent = saldo;
    document.getElementById('jogos').textContent = jogosJogados;
    document.getElementById('vitorias').textContent = vitorias;
    salvarDados();
}

// ===== PAINEL DO DONO SIMPLIFICADO =====
function gerenciarRanking() {
    console.log('🔧 ADMIN: Carregando ranking para painel do dono...');
    
    // Carrega ranking completo (não apenas top 10)
    let ranking = JSON.parse(localStorage.getItem('nukuzerabetRankingFinal') || '[]');
    
    // Remove jogadores antigos
    const quatroHorasAtras = Date.now() - (4 * 60 * 60 * 1000);
    ranking = ranking.filter(j => j.timestamp > quatroHorasAtras);
    
    // Ordena por saldo (todos, não apenas top 10)
    ranking = ranking.sort((a, b) => b.saldo - a.saldo);
    
    console.log('🔧 ADMIN: Ranking carregado:', ranking.length, 'jogadores');
    
    let html = `
        <div style="background: rgba(111, 66, 193, 0.1); border: 2px solid #6f42c1; border-radius: 10px; padding: 15px;">
            <h5 style="color: #6f42c1; margin-bottom: 15px;">🏆 GERENCIAR RANKING</h5>
            <div style="margin-bottom: 15px;">
                <button class="btn" onclick="limparRankingGlobal()" style="background: #dc3545; margin-right: 10px;">🗑️ LIMPAR RANKING</button>
                <button class="btn" onclick="removerBloqueios()" style="background: #28a745;">🔓 REMOVER BLOQUEIOS</button>
                <button class="btn" onclick="gerenciarRanking()" style="background: #17a2b8; margin-left: 10px;">🔄 ATUALIZAR</button>
            </div>
    `;
    
    if (ranking && ranking.length > 0) {
        console.log('🔧 ADMIN: Mostrando', ranking.length, 'jogadores no painel');
        html += '<h6 style="color: #6f42c1;">Jogadores no Ranking:</h6>';
        
        ranking.forEach((jogador, index) => {
            const tempoDecorrido = Math.floor((Date.now() - jogador.timestamp) / 1000 / 60);
            const taxaVitoria = jogador.jogos > 0 ? ((jogador.vitorias / jogador.jogos) * 100).toFixed(1) : 0;
            
            html += `
                <div style="background: rgba(255,255,255,0.1); padding: 10px; margin: 5px 0; border-radius: 5px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                        <span style="font-weight: bold;">${index + 1}º ${jogador.nome} - R$ ${jogador.saldo}</span>
                        <button class="btn btn-danger" onclick="removerJogadorRankingGlobal('${jogador.nome}')" style="padding: 2px 8px; font-size: 0.8em;">REMOVER</button>
                    </div>
                    <div style="font-size: 0.8em; color: #aaa;">
                        🎮 ${jogador.jogos} jogos | 🏆 ${jogador.vitorias} vitórias | 📊 ${taxaVitoria}% win rate | ⏰ ${tempoDecorrido}min atrás
                    </div>
                </div>
            `;
        });
    } else {
        console.log('🔧 ADMIN: Nenhum jogador encontrado no ranking');
        html += '<p style="text-align: center; color: #aaa;">Nenhum jogador no ranking ainda</p>';
    }
    
    html += '</div>';
    document.getElementById('resultadoPainelDono').innerHTML = html;
}

function limparRankingGlobal() {
    if (confirm('Tem certeza que deseja limpar todo o ranking? Isso removerá todos os jogadores!')) {
        console.log('🧹 Limpando ranking...');
        
        // Remove todas as chaves de ranking (principal e backups)
        const chaves = ['nukuzerabetRankingFinal', 'nukuzerabetRankingBackup1', 'nukuzerabetRankingBackup2'];
        chaves.forEach(chave => {
            localStorage.removeItem(chave);
            console.log('🗑️ Removida chave:', chave);
        });
        
        // Remove o nome do jogador do ranking para evitar que seja salvo novamente
        nomeJogadorRanking = null;
        salvarDados();
        
        document.getElementById('resultadoPainelDono').innerHTML = `
            <div class="codigo-sucesso">
                <p style="font-size: 1.3em;">✅ RANKING LIMPO!</p>
                <p>Todos os jogadores foram removidos de todas as bases</p>
                <p style="font-size: 0.9em; color: #ffaa00; margin-top: 10px;">Seu nome também foi removido do ranking</p>
            </div>
        `;
        
        setTimeout(gerenciarRanking, 2000);
    }
}

function removerJogadorRankingGlobal(nomeJogador) {
    if (confirm(`Remover ${nomeJogador} do ranking?`)) {
        console.log('🗑️ Removendo jogador:', nomeJogador);
        
        let ranking = JSON.parse(localStorage.getItem('nukuzerabetRankingFinal') || '[]');
        const tamanhoOriginal = ranking.length;
        ranking = ranking.filter(j => j.nome !== nomeJogador);
        localStorage.setItem('nukuzerabetRankingFinal', JSON.stringify(ranking));
        
        if (ranking.length < tamanhoOriginal) {
            console.log('✅ Jogador', nomeJogador, 'removido com sucesso');
        } else {
            console.log('⚠️ Jogador', nomeJogador, 'não encontrado');
        }
        
        gerenciarRanking();
    }
}

function removerBloqueios() {
    localStorage.removeItem('nukuzerabetBloqueioRanking');
    document.getElementById('resultadoPainelDono').innerHTML = `
        <div class="codigo-sucesso">
            <p style="font-size: 1.3em;">✅ BLOQUEIOS REMOVIDOS!</p>
        </div>
    `;
}

// ===== SISTEMA DE JOGOS =====
function abrirJogo(jogo) {
    const jogoCapitalizado = jogo.charAt(0).toUpperCase() + jogo.slice(1);
    const modal = document.getElementById('modal' + jogoCapitalizado);
    
    if (!modal) {
        console.error('Modal não encontrado:', 'modal' + jogoCapitalizado);
        return;
    }
    
    modal.style.display = 'block';
    
    // Configurações específicas por jogo
    switch(jogo) {
        case 'roleta':
            const tipoRoleta = document.getElementById('tipoRoleta');
            if (tipoRoleta) {
                tipoRoleta.onchange = atualizarOpcaoRoleta;
                atualizarOpcaoRoleta();
            }
            break;
        case 'dados':
            const tipoDados = document.getElementById('tipoDados');
            if (tipoDados) {
                tipoDados.onchange = atualizarOpcaoDados;
                atualizarOpcaoDados();
            }
            break;
        case 'ranking':
            mostrarRanking();
            break;
        case 'codigo':
            inicializarModalCodigo();
            break;
    }
}

function fecharModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// ===== SISTEMA DE BLOQUEIO POR VÍCIO =====
function adicionarFichas() {
    vezesFichasAdicionadas++;
    
    if (vezesFichasAdicionadas >= 4) {
        // Remove o jogador de TODOS os rankings
        if (nomeJogadorRanking) {
            // Remove do ranking principal
            localStorage.removeItem('nukuzerabetRankingFinal');
            
            // Bloqueia o jogador por 24 horas
            const bloqueioAte = Date.now() + (24 * 60 * 60 * 1000); // 24 horas
            localStorage.setItem('nukuzerabetBloqueioRanking', bloqueioAte.toString());
            
            console.log('🚫 Jogador bloqueado:', nomeJogadorRanking, 'até', new Date(bloqueioAte));
            
            // Remove o nome do ranking atual
            nomeJogadorRanking = null;
        }
        
        // Reseta o saldo para 1000
        saldo = 1000;
        jogosJogados = 0;
        vitorias = 0;
        vezesFichasAdicionadas = 0;
        
        const alertaDiv = document.createElement('div');
        alertaDiv.className = 'alerta-vicio';
        alertaDiv.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <h2>⚠️ DEIXA DE SER VICIADO! ⚠️</h2>
                <p style="margin: 15px 0;">Você foi removido do ranking!</p>
                <p style="margin: 15px 0;">🚫 Bloqueado por 24 horas</p>
                <p style="margin: 15px 0;">💰 Saldo resetado para R$ 1.000</p>
                <p style="font-size: 0.9em; color: #ffaa00;">Procure ajuda para vício em jogos!</p>
            </div>
        `;
        document.body.appendChild(alertaDiv);
        
        // Salva os dados atualizados
        salvarDados();
        
        setTimeout(() => {
            location.reload();
        }, 5000);
        return;
    }
    
    const mensagens = [
        { texto: "Você vendeu sua moto por R$ 2400!", valor: 2400 },
        { texto: "Você vendeu seu carro por R$ 15000!", valor: 15000 },
        { texto: "Você vendeu sua TV por R$ 800!", valor: 800 },
        { texto: "Você vendeu seu notebook por R$ 3500!", valor: 3500 },
        { texto: "Você vendeu seu celular por R$ 1200!", valor: 1200 },
        { texto: "Você pegou empréstimo no banco de R$ 5000!", valor: 5000 },
        { texto: "Você vendeu seu videogame por R$ 1500!", valor: 1500 },
        { texto: "Você vendeu sua bicicleta por R$ 600!", valor: 600 },
        { texto: "Você empenhou seu relógio por R$ 2000!", valor: 2000 },
        { texto: "Você vendeu seus móveis por R$ 4000!", valor: 4000 }
    ];
    
    const mensagemAleatoria = mensagens[Math.floor(Math.random() * mensagens.length)];
    saldo += mensagemAleatoria.valor;
    atualizarSaldo();
    alert(`${mensagemAleatoria.texto}\n\n💰 R$ ${mensagemAleatoria.valor} foram adicionados ao seu saldo!`);
}

// ===== SISTEMA DE BOOST DE SORTE =====
function ativarBoostSorte(duracao = 30 * 60 * 1000) { // 30 minutos por padrão
    boostSorteAtivo = true;
    boostSorteExpira = Date.now() + duracao;
    localStorage.setItem('nukuzerabetBoost', JSON.stringify({
        ativo: true,
        expira: boostSorteExpira
    }));
}

function verificarBoostSorte() {
    const boostSalvo = localStorage.getItem('nukuzerabetBoost');
    if (boostSalvo) {
        const boost = JSON.parse(boostSalvo);
        if (boost.ativo && boost.expira > Date.now()) {
            boostSorteAtivo = true;
            boostSorteExpira = boost.expira;
            return true;
        } else {
            // Boost expirou
            boostSorteAtivo = false;
            localStorage.removeItem('nukuzerabetBoost');
            return false;
        }
    }
    return false;
}

function getMultiplicadorSorte() {
    if (verificarBoostSorte()) {
        return 0.5; // Reduz a dificuldade em 50% (aumenta chance de ganhar)
    }
    return 0;
}

function getTempoRestanteBoost() {
    if (!boostSorteAtivo) return 0;
    const restante = boostSorteExpira - Date.now();
    return Math.max(0, restante);
}

// ===== CÓDIGOS PROMOCIONAIS =====
function inicializarModalCodigo() {
    const modalContent = document.querySelector('#modalCodigo .modal-content');
    if (!modalContent) return;
    
    modalContent.innerHTML = `
        <span class="close" onclick="fecharModal('modalCodigo')">&times;</span>
        <h2 style="color: #d4af37; margin-bottom: 20px;">💰 CÓDIGOS E BÔNUS 💰</h2>
        
        <div style="text-align: center; margin-bottom: 30px;">
            <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap; margin-bottom: 20px;">
                <button class="btn" onclick="mostrarCodigoPromocional()" style="background: linear-gradient(45deg, #4CAF50, #45a049);">
                    🎁 CÓDIGO PROMOCIONAL
                </button>
                <button class="btn" onclick="mostrarLoginDono()" style="background: linear-gradient(45deg, #ff6b35, #f7931e);">
                    👑 ÁREA DO DONO
                </button>
            </div>
        </div>
        <div id="areaConteudoCodigo"></div>
    `;
}

function mostrarCodigoPromocional() {
    const areaConteudo = document.getElementById('areaConteudoCodigo');
    if (!areaConteudo) return;
    
    areaConteudo.innerHTML = `
        <div style="background: rgba(76, 175, 80, 0.1); border: 2px solid #4CAF50; border-radius: 10px; padding: 20px; margin: 20px 0;">
            <h4 style="color: #4CAF50; text-align: center; margin-bottom: 20px;">🎁 CÓDIGO PROMOCIONAL</h4>
            <div style="text-align: center;">
                <input type="text" id="codigoPromocional" placeholder="Digite o código promocional" 
                       style="padding: 10px; border-radius: 5px; border: 1px solid #4CAF50; background: rgba(0,0,0,0.3); color: white; width: 250px; text-align: center;">
                <br><br>
                <button class="btn" onclick="validarCodigo()" style="background: #4CAF50;">VALIDAR CÓDIGO</button>
            </div>
            <div id="resultadoCodigo" style="margin-top: 20px;"></div>
        </div>
    `;
}

function validarCodigo() {
    const codigo = document.getElementById('codigoPromocional').value.trim().toUpperCase();
    const resultadoDiv = document.getElementById('resultadoCodigo');
    
    if (!codigo) {
        resultadoDiv.innerHTML = '<div class="codigo-erro"><p style="font-size: 1.2em;">❌ Digite um código!</p></div>';
        return;
    }
    
    if (codigo === '1107') {
        saldo += 20000;
        atualizarSaldo();
        salvarNoRanking();
        
        resultadoDiv.innerHTML = `
            <div class="codigo-sucesso">
                <p style="font-size: 2em;">🎉 CÓDIGO VÁLIDO! 🎉</p>
                <p style="font-size: 1.5em; margin: 20px 0; color: #00ff00; font-weight: bold;">+ R$ 20.000</p>
                <p style="color: #fff;">Bônus adicionado ao seu saldo!</p>
                <p style="color: #d4af37; margin-top: 15px; font-size: 0.9em;">✨ Você pode usar este código quantas vezes quiser!</p>
            </div>
        `;
    } else if (codigo === 'RATOBANHO') {
        ativarBoostSorte(30 * 60 * 1000); // 30 minutos
        
        resultadoDiv.innerHTML = `
            <div class="codigo-sucesso">
                <p style="font-size: 2em;">🍀 BOOST DE SORTE ATIVADO! 🍀</p>
                <p style="font-size: 1.3em; margin: 20px 0; color: #ffaa00; font-weight: bold;">+50% CHANCE DE GANHAR</p>
                <p style="color: #fff;">Boost ativo por 30 minutos!</p>
                <p style="color: #d4af37; margin-top: 15px; font-size: 0.9em;">🎯 Suas chances de vitória aumentaram significativamente!</p>
            </div>
        `;
    } else {
        resultadoDiv.innerHTML = `
            <div class="codigo-erro">
                <p style="font-size: 1.5em;">❌ CÓDIGO INVÁLIDO</p>
                <p style="color: #ff6b6b; margin-top: 10px;">Tente novamente com um código válido</p>
            </div>
        `;
    }
}

// Variável para controlar se o usuário está logado como DONO
let isDonoLogado = false;

function mostrarLoginDono() {
    const areaConteudo = document.getElementById('areaConteudoCodigo');
    if (!areaConteudo) return;
    
    if (isDonoLogado) {
        mostrarPainelDono();
        return;
    }
    
    areaConteudo.innerHTML = `
        <div style="background: rgba(255, 107, 53, 0.1); border: 2px solid #ff6b35; border-radius: 10px; padding: 20px; margin: 20px 0;">
            <h4 style="color: #ff6b35; text-align: center; margin-bottom: 20px;">👑 LOGIN DO DONO</h4>
            <div style="text-align: center;">
                <input type="password" id="senhaDono" placeholder="Digite a senha do dono" 
                       style="padding: 10px; border-radius: 5px; border: 1px solid #ff6b35; background: rgba(0,0,0,0.3); color: white; width: 250px; text-align: center;">
                <br><br>
                <button class="btn" onclick="validarLoginDono()" style="background: #ff6b35;">ENTRAR</button>
            </div>
            <div id="resultadoLogin" style="margin-top: 20px;"></div>
        </div>
    `;
}

function validarLoginDono() {
    const senha = document.getElementById('senhaDono').value.trim();
    const resultadoDiv = document.getElementById('resultadoLogin');
    
    if (!senha) {
        resultadoDiv.innerHTML = '<div class="codigo-erro"><p style="font-size: 1.2em;">❌ Digite a senha!</p></div>';
        return;
    }
    
    const senhaCorreta = '1107';
    
    if (senha === senhaCorreta) {
        isDonoLogado = true;
        resultadoDiv.innerHTML = `
            <div class="codigo-sucesso">
                <p style="font-size: 1.5em;">✅ LOGIN REALIZADO!</p>
                <p style="color: #00ff00; margin-top: 10px;">Bem-vindo, DONO!</p>
            </div>
        `;
        
        setTimeout(() => {
            mostrarPainelDono();
        }, 2000);
    } else {
        resultadoDiv.innerHTML = `
            <div class="codigo-erro">
                <p style="font-size: 1.5em;">❌ SENHA INCORRETA</p>
                <p style="color: #ff6b6b; margin-top: 10px;">Acesso negado!</p>
            </div>
        `;
    }
}

function mostrarPainelDono() {
    const areaConteudo = document.getElementById('areaConteudoCodigo');
    if (!areaConteudo) return;
    
    areaConteudo.innerHTML = `
        <div style="background: rgba(255, 215, 0, 0.1); border: 2px solid #d4af37; border-radius: 10px; padding: 20px; margin: 20px 0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h4 style="color: #d4af37; margin: 0;">👑 PAINEL DO DONO</h4>
                <button class="btn btn-danger" onclick="logoutDono()" style="background: #dc3545; padding: 5px 15px; font-size: 0.9em;">SAIR</button>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
                <button class="btn" onclick="adicionarSaldoDono()" style="background: #28a745;">💰 ADICIONAR SALDO</button>
                <button class="btn" onclick="resetarJogador()" style="background: #dc3545;">🔄 RESETAR JOGADOR</button>
                <button class="btn" onclick="verEstatisticas()" style="background: #17a2b8;">📊 ESTATÍSTICAS</button>
                <button class="btn" onclick="gerenciarRanking()" style="background: #6f42c1;">🏆 GERENCIAR RANKING</button>
            </div>
            
            <div id="resultadoPainelDono"></div>
        </div>
    `;
}

function logoutDono() {
    isDonoLogado = false;
    inicializarModalCodigo();
}

function adicionarSaldoDono() {
    const valor = prompt('Digite o valor a ser adicionado ao saldo:');
    if (valor && !isNaN(valor) && parseInt(valor) > 0) {
        const valorInt = parseInt(valor);
        saldo += valorInt;
        atualizarSaldo();
        salvarNoRanking();
        
        document.getElementById('resultadoPainelDono').innerHTML = `
            <div class="codigo-sucesso">
                <p style="font-size: 1.3em;">✅ SALDO ADICIONADO!</p>
                <p style="color: #00ff00;">+ R$ ${valorInt} adicionados ao saldo</p>
                <p>Saldo atual: R$ ${saldo}</p>
            </div>
        `;
    } else {
        document.getElementById('resultadoPainelDono').innerHTML = `
            <div class="codigo-erro">
                <p style="font-size: 1.3em;">❌ VALOR INVÁLIDO</p>
            </div>
        `;
    }
}

function resetarJogador() {
    if (confirm('Tem certeza que deseja resetar todos os dados do jogador?')) {
        saldo = 1000;
        jogosJogados = 0;
        vitorias = 0;
        vezesFichasAdicionadas = 0;
        nomeJogadorRanking = null;
        
        // Remove do ranking
        localStorage.removeItem('nukuzerabetRankingFinal');
        
        // Remove bloqueio se existir
        localStorage.removeItem('nukuzerabetBloqueioRanking');
        
        atualizarSaldo();
        salvarDados();
        
        document.getElementById('resultadoPainelDono').innerHTML = `
            <div class="codigo-sucesso">
                <p style="font-size: 1.3em;">✅ JOGADOR RESETADO!</p>
                <p style="color: #00ff00;">Todos os dados foram restaurados ao padrão</p>
            </div>
        `;
    }
}

function verEstatisticas() {
    const taxaVitoria = jogosJogados > 0 ? ((vitorias / jogosJogados) * 100).toFixed(1) : 0;
    const bloqueio = localStorage.getItem('nukuzerabetBloqueioRanking');
    let statusBloqueio = 'Não bloqueado';
    
    if (bloqueio) {
        const tempoRestante = parseInt(bloqueio) - Date.now();
        if (tempoRestante > 0) {
            const horasRestantes = Math.ceil(tempoRestante / (1000 * 60 * 60));
            statusBloqueio = `Bloqueado por ${horasRestantes} horas`;
        }
    }
    
    // Verifica boost de sorte
    let statusBoost = 'Inativo';
    if (verificarBoostSorte()) {
        const tempoRestante = getTempoRestanteBoost();
        const minutos = Math.floor(tempoRestante / 60000);
        const segundos = Math.floor((tempoRestante % 60000) / 1000);
        statusBoost = `Ativo (${minutos}:${segundos.toString().padStart(2, '0')} restantes)`;
    }
    
    document.getElementById('resultadoPainelDono').innerHTML = `
        <div style="background: rgba(23, 162, 184, 0.1); border: 2px solid #17a2b8; border-radius: 10px; padding: 15px;">
            <h5 style="color: #17a2b8; margin-bottom: 15px;">📊 ESTATÍSTICAS COMPLETAS DO JOGADOR</h5>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 10px;">
                <p><strong>💰 Saldo:</strong> R$ ${saldo}</p>
                <p><strong>🎮 Jogos:</strong> ${jogosJogados}</p>
                <p><strong>🏆 Vitórias:</strong> ${vitorias}</p>
                <p><strong>📊 Taxa de Vitória:</strong> ${taxaVitoria}%</p>
                <p><strong>🎰 Fichas Adicionadas:</strong> ${vezesFichasAdicionadas}/4</p>
                <p><strong>👤 Nome no Ranking:</strong> ${nomeJogadorRanking || 'Não cadastrado'}</p>
                <p><strong>🚫 Status Bloqueio:</strong> ${statusBloqueio}</p>
                <p><strong>🍀 Boost de Sorte:</strong> ${statusBoost}</p>
            </div>
        </div>
    `;
}

// Fecha modal ao clicar fora dele
window.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
});

console.log('🎰 NokuzeraBet carregado com sistema de ranking simplificado!');
