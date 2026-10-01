/* Afra Beauty | vitrine, filtros, sacolinha e pedido pelo WhatsApp */
(() => {
  'use strict';

  // ---------- configuração da loja ----------
  const LOJA_URL = 'https://www.afrabeauty.com.br'; // loja online (Stoqui): checkout com cartão
  const WHATS = '5551982032553';
  const CUPOM = '10OFF';
  const PIX_MINIMO = 60;   // cupom vale acima de R$ 60
  const PIX_DESCONTO = 0.10;
  const CHAVE_SACOLA = 'afra-sacolinha';

  const NOMES_CAT = {
    boca: 'Boca', olhos: 'Olhos', pele: 'Pele', skincare: 'Skincare', corpo: 'Corpo e perfume',
    cabelo: 'Cabelo', acessorios: 'Acessórios', presentes: 'Kits',
  };

  const produtos = window.PRODUTOS || [];
  const porId = new Map(produtos.map((p, i) => [p.id, { ...p, ordem: i }]));

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const reais = (v) => brl.format(v);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const parcela = (preco) => (preco >= 22 ? Math.ceil((preco * 100) / 2) / 100 : null);
  const linkWhats = (texto) => `https://wa.me/${WHATS}?text=${encodeURIComponent(texto)}`;
  const linkProduto = (p) => `${LOJA_URL}/produto/${p.slug}`;
  const movimentoReduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- links externos ----------
  $$('[data-whats]').forEach((a) => {
    a.href = linkWhats(a.dataset.whats);
    a.target = '_blank';
    a.rel = 'noopener';
  });
  $$('[data-loja-online]').forEach((a) => { a.href = LOJA_URL; });

  // ---------- aviso (toast) ----------
  const aviso = $('[data-aviso]');
  let avisoTimer;
  function avisar(texto, acao) {
    aviso.innerHTML = `<span>${esc(texto)}</span>`;
    if (acao) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = acao.rotulo;
      b.addEventListener('click', () => { esconderAviso(); acao.fazer(); });
      aviso.append(b);
    }
    // um <dialog> aberto fica na camada de cima: o aviso entra nele para não sumir atrás
    (document.querySelector('dialog[open]') || document.body).append(aviso);
    aviso.classList.add('aviso--ver');
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(esconderAviso, 3600);
  }
  function esconderAviso() { aviso.classList.remove('aviso--ver'); }

  // ---------- copiar cupom ----------
  $$('[data-copiar]').forEach((b) => {
    b.addEventListener('click', async () => {
      const codigo = b.dataset.copiar;
      try {
        await navigator.clipboard.writeText(codigo);
        avisar(`Cupom ${codigo} copiado. Vale no Pix acima de R$ 60.`);
      } catch {
        avisar(`Teu cupom é ${codigo}. Vale no Pix acima de R$ 60.`);
      }
    });
  });

  // ---------- topo: filete ao rolar e menu do celular ----------
  const topo = $('[data-topo]');
  const cupom = $('.cupom');
  if ('IntersectionObserver' in window && cupom) {
    new IntersectionObserver(([e]) => topo.classList.toggle('topo--rolou', !e.isIntersecting)).observe(cupom);
  }

  const menu = $('#menu');
  const menuBotao = $('[data-menu-botao]');
  function alternarMenu(abrir) {
    const aberto = abrir ?? !menu.classList.contains('menu--aberto');
    menu.classList.toggle('menu--aberto', aberto);
    menuBotao.setAttribute('aria-expanded', String(aberto));
    menuBotao.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
    menuBotao.innerHTML = `<i class="ph ${aberto ? 'ph-x' : 'ph-list'}" aria-hidden="true"></i>`;
  }
  menuBotao.addEventListener('click', () => alternarMenu());
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) alternarMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('menu--aberto')) { alternarMenu(false); menuBotao.focus(); } });
  document.addEventListener('click', (e) => {
    if (menu.classList.contains('menu--aberto') && !e.target.closest('#menu, [data-menu-botao]')) alternarMenu(false);
  });

  // ---------- revelar ao rolar ----------
  let observadorRevelar = null;
  if ('IntersectionObserver' in window && !movimentoReduzido) {
    document.documentElement.classList.add('revelar-pronto');
    observadorRevelar = new IntersectionObserver((entradas) => {
      entradas.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('animate'); observadorRevelar.unobserve(e.target); }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
  }
  function revelar(els) {
    if (!observadorRevelar) return;
    els.forEach((el) => {
      const irmaos = [...el.parentElement.children].filter((c) => c.hasAttribute('data-revelar'));
      const i = irmaos.indexOf(el);
      // na grade, o atraso segue a coluna: cada fileira entra junta, sem fila de espera
      el.style.setProperty('--i', String(el.parentElement.matches('[data-grade]') ? i % 4 : Math.min(i, 5)));
      observadorRevelar.observe(el);
    });
  }
  revelar($$('[data-revelar]'));

  // ---------- sacolinha (estado) ----------
  const sacola = new Map();
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_SACOLA) || '[]');
    salvo.forEach(([id, qtd]) => { if (porId.has(id) && qtd > 0) sacola.set(id, Math.min(qtd, 20)); });
  } catch { /* sem armazenamento: a sacolinha vive só nesta visita */ }

  function salvar() {
    try { localStorage.setItem(CHAVE_SACOLA, JSON.stringify([...sacola])); } catch { /* ignora */ }
  }
  const totalItens = () => [...sacola.values()].reduce((a, b) => a + b, 0);
  const subtotal = () => [...sacola].reduce((s, [id, q]) => s + porId.get(id).preco * q, 0);

  function adicionar(id, qtd = 1, origem) {
    const p = porId.get(id);
    if (!p) return;
    sacola.set(id, Math.min((sacola.get(id) || 0) + qtd, 20));
    salvar();
    atualizarSacola(true);
    if (origem) {
      origem.classList.add('card__add--ok');
      const antes = origem.innerHTML;
      origem.innerHTML = '<i class="ph ph-check" aria-hidden="true"></i>';
      setTimeout(() => { origem.classList.remove('card__add--ok'); origem.innerHTML = antes; }, 1200);
    }
    avisar(`${p.nome} foi pra sacolinha.`, { rotulo: 'Ver sacolinha', fazer: abrirSacola });
  }

  function definir(id, qtd) {
    const antes = sacola.get(id) || 0;
    if (qtd <= 0) sacola.delete(id); else sacola.set(id, Math.min(qtd, 20));
    salvar();
    atualizarSacola(false);
    if (qtd <= 0 && antes > 0) {
      avisar(`${porId.get(id).nome} saiu da sacolinha.`, { rotulo: 'Desfazer', fazer: () => definir(id, antes) });
    }
  }

  // ---------- sacolinha (tela) ----------
  const dlgSacola = $('[data-sacola-dialog]');
  const qtdTopo = $('[data-sacola-qtd]');
  const botaoTopo = $('.sacola-botao');
  const flutWhats = $('.flutuante__whats');
  const flutSacola = $('.flutuante__sacola');
  const flutResumo = $('[data-flutuante-resumo]');

  function atualizarSacola(pular) {
    const n = totalItens();
    const total = subtotal();
    qtdTopo.hidden = n === 0;
    qtdTopo.textContent = String(n);
    botaoTopo.setAttribute('aria-label', `Abrir sacolinha, ${n} ${n === 1 ? 'item' : 'itens'}`);
    if (pular && !movimentoReduzido) { qtdTopo.classList.remove('pulo'); void qtdTopo.offsetWidth; qtdTopo.classList.add('pulo'); }

    flutSacola.hidden = n === 0;
    flutWhats.hidden = n > 0;
    flutResumo.textContent = `${n} ${n === 1 ? 'item' : 'itens'} · ${reais(total)}`;

    // lista
    const lista = $('[data-sacola-itens]');
    lista.innerHTML = [...sacola].map(([id, q]) => {
      const p = porId.get(id);
      return `<li class="item">
        <img src="${esc(p.img)}" alt="" width="64" height="80" loading="lazy">
        <div>
          <p class="item__nome">${esc(p.nome)}</p>
          <p class="item__preco">${reais(p.preco)}${q > 1 ? ` cada` : ''}</p>
        </div>
        <div class="item__lado">
          <div class="qtd" role="group" aria-label="Quantidade de ${esc(p.nome)}">
            <button type="button" data-menos="${id}" aria-label="Diminuir"><i class="ph ph-minus" aria-hidden="true"></i></button>
            <output aria-live="polite">${q}</output>
            <button type="button" data-mais-um="${id}" aria-label="Aumentar"><i class="ph ph-plus" aria-hidden="true"></i></button>
          </div>
          <button type="button" class="item__remover" data-remover="${id}">Remover</button>
        </div>
      </li>`;
    }).join('');

    $('[data-sacola-vazia]').hidden = n > 0;
    $('[data-sacola-fim]').hidden = n === 0;
    $('[data-sacola-subtotal]').textContent = reais(total);

    const pix = $('[data-sacola-pix]');
    const linhaPix = $('[data-sacola-linha-pix]');
    if (n === 0) {
      pix.innerHTML = '';
      linhaPix.hidden = true;
    } else if (total < PIX_MINIMO) {
      const falta = PIX_MINIMO - total;
      const pct = Math.round((total / PIX_MINIMO) * 100);
      pix.innerHTML = `<p><i class="ph ph-pix-logo" aria-hidden="true"></i><span>Faltam <strong>${reais(falta)}</strong> para ganhar 10% de desconto no Pix.</span></p>
        <div class="sacola__barra" style="--p:${pct}%" role="progressbar" aria-label="Caminho até o desconto no Pix" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"></div>`;
      linhaPix.hidden = true;
    } else {
      pix.innerHTML = `<p><i class="ph-fill ph-check-circle" aria-hidden="true"></i><span>Oba! No Pix, teu pedido ganha 10% com o cupom <strong>${CUPOM}</strong>.</span></p>`;
      linhaPix.hidden = false;
      $('[data-sacola-pix-valor]').textContent = reais(total * (1 - PIX_DESCONTO));
    }
  }

  $('[data-sacola-itens]').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.menos) definir(b.dataset.menos, (sacola.get(b.dataset.menos) || 0) - 1);
    if (b.dataset.maisUm) definir(b.dataset.maisUm, (sacola.get(b.dataset.maisUm) || 0) + 1);
    if (b.dataset.remover) definir(b.dataset.remover, 0);
    if (!sacola.size) $('[data-ir-loja]').focus();
  });

  function travar(sim) { document.documentElement.classList.toggle('travado', sim); }
  function abrirDialogo(d) {
    if (d.open) return;
    alternarMenu(false);
    d.showModal();
    travar(true);
  }
  function abrirSacola() { atualizarSacola(false); abrirDialogo(dlgSacola); }

  $$('[data-abrir-sacola]').forEach((b) => b.addEventListener('click', abrirSacola));
  $$('dialog').forEach((d) => {
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    d.addEventListener('close', () => { travar(false); if (aviso.parentElement === d) document.body.append(aviso); });
    $$('[data-fechar]', d).forEach((b) => b.addEventListener('click', () => d.close()));
  });
  $('[data-ir-loja]').addEventListener('click', () => {
    dlgSacola.close();
    $('#loja').scrollIntoView({ behavior: movimentoReduzido ? 'auto' : 'smooth' });
  });

  $('[data-finalizar]').addEventListener('click', () => {
    const linhas = [...sacola].map(([id, q]) => {
      const p = porId.get(id);
      return `• ${q}x ${p.nome}${p.marca ? ` (${p.marca})` : ''}: ${reais(p.preco * q)}`;
    });
    const total = subtotal();
    const texto = [
      'Oi, Afra! Quero fazer este pedido pelo site:', '',
      ...linhas, '',
      `Subtotal: ${reais(total)}`,
      ...(total >= PIX_MINIMO ? [`No Pix com o cupom ${CUPOM}: ${reais(total * (1 - PIX_DESCONTO))}`] : []),
      '',
      'Forma de pagamento (Pix ou cartão): ',
      'Meu CEP: ',
    ].join('\n');
    window.open(linkWhats(texto), '_blank', 'noopener');
  });

  // ---------- vitrine ----------
  const grade = $('[data-grade]');
  const contagem = $('[data-contagem]');
  const botaoMais = $('[data-mais]');
  const vazio = $('[data-vazio]');
  const busca = $('[data-busca]');
  const selOrdem = $('[data-ordem]');
  const botaoAte15 = $('[data-ate15]');
  const passo = () => (matchMedia('(min-width: 1024px)').matches ? 16 : 12);

  const estado = { cat: 'tudo', ate15: false, ordem: 'variados', busca: '', limite: passo() };

  function filtrados() {
    const termo = semAcento(estado.busca.trim());
    let lista = [...porId.values()].filter((p) =>
      (estado.cat === 'tudo' || p.cat === estado.cat) &&
      (!estado.ate15 || p.preco <= 15) &&
      (!termo || semAcento(`${p.nome} ${p.marca || ''} ${NOMES_CAT[p.cat]}`).includes(termo)));
    if (estado.ordem === 'menor') lista.sort((a, b) => a.preco - b.preco || a.ordem - b.ordem);
    else if (estado.ordem === 'maior') lista.sort((a, b) => b.preco - a.preco || a.ordem - b.ordem);
    else lista.sort((a, b) => a.ordem - b.ordem);
    if (estado.ordem === 'variados') lista = alternarCategorias(lista);
    return lista;
  }

  // "Variados": uma de cada categoria por vez, para a primeira tela não ser três geleias seguidas
  const ORDEM_CAT = ['boca', 'corpo', 'olhos', 'skincare', 'pele', 'presentes', 'acessorios', 'cabelo'];
  function alternarCategorias(lista) {
    const filas = ORDEM_CAT.map((c) => lista.filter((p) => p.cat === c));
    const saida = [];
    while (filas.some((f) => f.length)) filas.forEach((f) => { if (f.length) saida.push(f.shift()); });
    return saida;
  }

  function cardHTML(p, comRevelar) {
    const parc = parcela(p.preco);
    return `<li class="card"${comRevelar ? ' data-revelar' : ''}>
      <button type="button" class="card__foto" data-detalhe="${p.id}" tabindex="-1" aria-hidden="true">
        <img src="${esc(p.img)}" alt="" width="360" height="480" loading="lazy" decoding="async">
      </button>
      ${p.marca ? `<p class="card__marca">${esc(p.marca)}</p>` : ''}
      <h3 class="card__nome"><button type="button" data-detalhe="${p.id}">${esc(p.nome)}</button></h3>
      <div class="card__compra">
        <p class="preco">${reais(p.preco)}${parc ? `<small>ou 2x de ${reais(parc)}</small>` : ''}</p>
        <button type="button" class="card__add" data-add="${p.id}" aria-label="Adicionar ${esc(p.nome)} à sacolinha"><i class="ph ph-plus" aria-hidden="true"></i></button>
      </div>
    </li>`;
  }

  let primeiraVez = true;
  function renderizar(manterLimite) {
    if (!manterLimite) estado.limite = passo();
    const lista = filtrados();
    const visiveis = lista.slice(0, estado.limite);
    const jaTinha = manterLimite ? grade.children.length : 0;

    if (manterLimite) {
      grade.insertAdjacentHTML('beforeend', visiveis.slice(jaTinha).map((p) => cardHTML(p, true)).join(''));
      revelar([...grade.children].slice(jaTinha));
    } else {
      grade.innerHTML = visiveis.map((p) => cardHTML(p, primeiraVez)).join('');
      if (primeiraVez) revelar([...grade.children]);
      primeiraVez = false;
    }

    const n = lista.length;
    const resta = n - visiveis.length;
    contagem.textContent = !n ? '' : resta > 0 ? `Mostrando ${visiveis.length} de ${n} produtos` : `${n} ${n === 1 ? 'produto' : 'produtos'}`;
    vazio.hidden = n > 0;
    botaoMais.hidden = resta <= 0;
    botaoMais.textContent = `Mostrar mais ${Math.min(resta, passo())} ${Math.min(resta, passo()) === 1 ? 'produto' : 'produtos'}`;
  }

  function escolherCategoria(cat) {
    estado.cat = cat;
    $$('[data-cat]').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.cat === cat)));
    // o filtro vai para o endereço: dá para mandar "afrabeauty.com.br/?categoria=presentes#loja" no Insta
    try {
      const u = new URL(location.href);
      if (cat === 'tudo') u.searchParams.delete('categoria'); else u.searchParams.set('categoria', cat);
      history.replaceState(null, '', u);
    } catch { /* file:// ou navegador antigo */ }
    renderizar();
  }

  $('[data-chips]').addEventListener('click', (e) => {
    const c = e.target.closest('[data-cat]');
    if (c) escolherCategoria(c.dataset.cat);
  });
  botaoAte15.addEventListener('click', () => {
    estado.ate15 = !estado.ate15;
    botaoAte15.setAttribute('aria-pressed', String(estado.ate15));
    renderizar();
  });
  selOrdem.addEventListener('change', () => { estado.ordem = selOrdem.value; renderizar(); });
  let buscaTimer;
  busca.addEventListener('input', () => {
    clearTimeout(buscaTimer);
    buscaTimer = setTimeout(() => { estado.busca = busca.value; renderizar(); }, 160);
  });
  botaoMais.addEventListener('click', () => {
    const primeiroNovo = grade.children.length;
    estado.limite += passo();
    renderizar(true);
    grade.children[primeiroNovo]?.querySelector('.card__nome button')?.focus({ preventScroll: true });
  });
  $('[data-limpar]').addEventListener('click', () => {
    busca.value = ''; estado.busca = ''; estado.ate15 = false; estado.ordem = 'variados';
    selOrdem.value = 'variados';
    botaoAte15.setAttribute('aria-pressed', 'false');
    escolherCategoria('tudo');
  });
  $$('[data-filtrar]').forEach((b) => b.addEventListener('click', () => {
    escolherCategoria(b.dataset.filtrar);
    $('#loja').scrollIntoView({ behavior: movimentoReduzido ? 'auto' : 'smooth' });
  }));

  // cliques de compra em qualquer lugar da página
  document.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) { adicionar(add.dataset.add, 1, add.classList.contains('card__add') ? add : null); return; }
    const det = e.target.closest('[data-detalhe]');
    if (det) abrirDetalhe(det.dataset.detalhe);
  });

  // ---------- detalhe do produto ----------
  const dlgProduto = $('[data-produto-dialog]');
  const detalhe = $('[data-detalhe-corpo]', dlgProduto);
  function abrirDetalhe(id) {
    const p = porId.get(id);
    if (!p) return;
    const parc = parcela(p.preco);
    let qtd = 1;
    detalhe.innerHTML = `
      <div class="detalhe__foto"><img src="${esc(p.img)}" alt="${esc(p.nome)}" width="640" height="640"></div>
      <div class="detalhe__info">
        ${p.marca ? `<p class="card__marca">${esc(p.marca)} · ${NOMES_CAT[p.cat]}</p>` : `<p class="card__marca">${NOMES_CAT[p.cat]}</p>`}
        <h2 class="detalhe__nome" id="produto-nome">${esc(p.nome)}</h2>
        <p class="preco">${reais(p.preco)}${parc ? `<small>ou 2x de ${reais(parc)} sem juros</small>` : ''}</p>
        <div class="detalhe__acoes">
          <div class="qtd" role="group" aria-label="Quantidade">
            <button type="button" data-q="-1" aria-label="Diminuir"><i class="ph ph-minus" aria-hidden="true"></i></button>
            <output aria-live="polite">1</output>
            <button type="button" data-q="1" aria-label="Aumentar"><i class="ph ph-plus" aria-hidden="true"></i></button>
          </div>
          <button type="button" class="botao botao--cheio botao--largo" data-por-na-sacola><i class="ph ph-handbag-simple" aria-hidden="true"></i>Adicionar à sacolinha</button>
          <a class="detalhe__loja" href="${esc(linkProduto(p))}" target="_blank" rel="noopener">Ver descrição completa na loja online<i class="ph ph-arrow-up-right" aria-hidden="true"></i></a>
        </div>
      </div>`;
    const out = $('output', detalhe);
    $$('[data-q]', detalhe).forEach((b) => b.addEventListener('click', () => {
      qtd = Math.max(1, Math.min(20, qtd + Number(b.dataset.q)));
      out.textContent = String(qtd);
    }));
    $('[data-por-na-sacola]', detalhe).addEventListener('click', () => {
      dlgProduto.close();
      adicionar(p.id, qtd);
    });
    abrirDialogo(dlgProduto);
  }

  // ---------- produtos dos reels ----------
  $$('[data-produto-id]').forEach((el) => {
    const p = porId.get(el.dataset.produtoId);
    if (!p) { el.closest('.reel')?.remove(); return; }
    el.innerHTML = `
      <h3 class="mini__nome"><button type="button" data-detalhe="${p.id}">${esc(p.nome)}</button></h3>
      <p class="preco">${reais(p.preco)}</p>
      <button type="button" class="card__add" data-add="${p.id}" aria-label="Adicionar ${esc(p.nome)} à sacolinha"><i class="ph ph-plus" aria-hidden="true"></i></button>`;
  });

  const catInicial = new URLSearchParams(location.search).get('categoria');
  if (catInicial && NOMES_CAT[catInicial]) escolherCategoria(catInicial); else renderizar();
  atualizarSacola(false);

  // atualizar a página (F5 / puxar para recarregar) sempre volta para o hero,
  // mesmo que o endereço tenha ficado com #loja de um clique no menu
  const navegacao = performance.getEntriesByType?.('navigation')[0];
  const recarregou = navegacao ? navegacao.type === 'reload' : performance.navigation?.type === 1;
  if (recarregou) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    const topo = () => window.scrollTo({ top: 0, behavior: 'instant' });
    topo();
    window.addEventListener('load', topo, { once: true });
  } else if (location.hash.length > 1) {
    // link com âncora vindo de fora (ex.: Insta com #loja): rola depois que a vitrine já tem altura
    const alvo = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (alvo) setTimeout(() => alvo.scrollIntoView({ behavior: 'instant' }), 0);
  }
})();
