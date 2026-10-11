# Banda de Ouvido

Banda automática que **escuta a voz, descobre o tom sozinha e acompanha**. Pensada para igrejas e cantores que não têm músicos disponíveis. Funciona no navegador, sem servidor e sem internet depois de aberta (as fontes do Google são opcionais).

> Estado: protótipo (Fase 1 a 2 do plano). Não é produto final.

## O que já faz

- **Detecta o tom pela voz**, mesmo desafinada: calcula a sua afinação média e corrige a leitura das notas (algoritmo YIN para a altura, perfis de Krumhansl para o tom).
- **Confiança progressiva:** começa só com ritmo, depois entra baixo, teclado e cordas conforme o tom fica firme. Poucas notas diferentes mantêm a banda cautelosa.
- **Estilos:** Balada R&B, Rock e Forró (levadas em rascunho, feitas para o músico ajustar). Violão e guitarra por síntese de corda (Karplus-Strong), piano elétrico, órgão e sanfona.
- **Cifras:** cole a cifra (acordes numa linha, letra embaixo). O app lê, **transpõe para o tom em que você canta**, e toca a progressão. Segura o acorde se você ainda estiver nele, aceita pular para outro acorde, e salva músicas no aparelho para montar um **pot-pourri**.
- **Voz de teste:** cantor sintético com tom, desafinação e instabilidade ajustáveis, para validar o detector sem microfone.

## Como usar

1. Abra a página em **https** (veja abaixo). O microfone só funciona em páginas seguras.
2. Toque em **Cantar no microfone** e cantarole umas 4 notas. Use fones de ouvido para a banda não voltar no microfone.
3. Para tocar uma cifra: cole, escolha onde começar tocando num acorde, e toque em **Tocar cifra**.

## Publicar de graça no GitHub Pages (microfone funciona)

1. Crie um repositório novo no GitHub e envie estes arquivos (pelo site: *Add file → Upload files*).
2. Em **Settings → Pages**, escolha *Deploy from a branch*, branch `main`, pasta `/ (root)`.
3. Abra o endereço `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/` no Chrome ou Safari.

## Direitos autorais

O app **não traz catálogo** de músicas, cifras nem letras. As cifras que você cola ficam só no seu aparelho (localStorage) e nada é enviado. Use apenas conteúdo que você tem direito de usar: hinos de domínio público, músicas autorais ou material licenciado. Baixar ou redistribuir cifras de sites como o Cifra Club por meio do app não é suportado e pode violar os termos desses sites e a lei de direitos autorais. Para um catálogo grande, procure licenciamento com editoras ou parceria com o próprio site. Isto não é aconselhamento jurídico.

## Limites conhecidos

- Com poucas notas diferentes o tom é ambíguo (por exemplo, só Dó, Mi e Sol cabem em vários tons).
- Ainda não segue o andamento do cantor: usa o BPM do estilo.
- Sem cancelamento do eco da banda no microfone: use fones.
- O acompanhamento da cifra avança por tempo e só corrige por altura das notas (não ouve a letra).

## Roadmap

1. Seguir o andamento do cantor.
2. Cancelamento de eco e filtro de ruído.
3. Back vocal com harmonias automáticas.
4. Reconhecimento da letra (opcional, online) para localizar a música.
5. Modo palco: botões grandes, pedal Bluetooth, tela sempre ligada.
6. PWA instalável e offline total.
7. Mais estilos (sertanejo, samba, pop, worship) e levadas revisadas por músicos.

## Testes

`testes/motor.js` e `testes/cifra.js` são o detector de tom e o leitor de cifras, extraídos da página para teste em Node. O código vivo está em `index.html`.
