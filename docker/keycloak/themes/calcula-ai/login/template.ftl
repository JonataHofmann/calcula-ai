<#--
  Layout base de TODAS as páginas do login (login, registro, reset, OTP, erro…).
  parent=base entrega só os macros/i18n; o HTML e o visual são 100% nossos.
  As páginas do base chamam `<@layout.registrationLayout ...; section>` e este macro
  injeta cada trecho via `<#nested "header|form|info">`.
-->
<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true displayRequiredFields=false>
<!DOCTYPE html>
<html lang="${(locale.currentLanguageTag)!'pt-BR'}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${(realm.displayName)!msg("loginTitle","Calcula aí")}</title>
  <meta name="robots" content="noindex, nofollow">
  <meta name="theme-color" content="#3730c9">
  <link rel="icon"
        href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%233730c9'/%3E%3Ctext x='16' y='22' font-size='18' font-family='Arial' font-weight='bold' fill='white' text-anchor='middle'%3EC%3C/text%3E%3C/svg%3E">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <#if properties.styles?has_content>
    <#list properties.styles?split(' ') as style>
      <link href="${url.resourcesPath}/${style}" rel="stylesheet"/>
    </#list>
  </#if>
</head>
<body class="kc-body ${bodyClass}">
  <div class="kc-shell">
    <aside class="kc-brand" aria-hidden="true">
      <div class="kc-brand__aurora"></div>
      <div class="kc-brand__inner">
        <div class="kc-brand__logo">
          <svg width="40" height="40" viewBox="0 0 32 32" role="img"><rect width="32" height="32" rx="9" fill="#ffffff"/><text x="16" y="23" font-size="19" font-family="Inter, Arial, sans-serif" font-weight="800" fill="#3730c9" text-anchor="middle">C</text></svg>
          <span>Calcula aí</span>
        </div>
        <h2 class="kc-brand__title">Suas finanças,<br>sob controle.</h2>
        <p class="kc-brand__text">Importe faturas, categorize com IA e acompanhe cada centavo em um só lugar.</p>

        <ul class="kc-features">
          <li>
            <span class="kc-features__ic"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v3H2V6a2 2 0 0 1 2-2Zm-2 7h20v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7Zm4 4v2h6v-2H6Z"/></svg></span>
            <span>Importe faturas em segundos</span>
          </li>
          <li>
            <span class="kc-features__ic"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="m12 2 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 14.8 7.2 17l.9-5.4L4.2 7.7l5.4-.8L12 2Z"/></svg></span>
            <span>Categorização automática com IA</span>
          </li>
          <li>
            <span class="kc-features__ic"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 19h16v2H2V3h2v16Zm3-3 4-5 3 3 5-6 1.5 1.2L14 17l-3-3-3 3.7L7 16Z"/></svg></span>
            <span>Previsão de despesas dos próximos meses</span>
          </li>
        </ul>

        <div class="kc-brand__card">
          <div class="kc-brand__card-top">
            <span class="kc-brand__card-label">Saldo do mês</span>
            <span class="kc-brand__card-chip">Agosto</span>
          </div>
          <strong class="kc-brand__card-value">R$ 4.820,00</strong>
          <div class="kc-brand__bars">
            <span style="height:38%"></span><span style="height:62%"></span><span style="height:48%"></span>
            <span style="height:80%"></span><span style="height:56%"></span><span style="height:70%"></span>
          </div>
        </div>
      </div>
    </aside>

    <main class="kc-main">
      <div class="kc-card">
        <div class="kc-card__brandmobile">
          <svg width="34" height="34" viewBox="0 0 32 32" role="img"><rect width="32" height="32" rx="8" fill="#3730c9"/><text x="16" y="22" font-size="18" font-family="Inter, Arial, sans-serif" font-weight="800" fill="#ffffff" text-anchor="middle">C</text></svg>
          <span>Calcula aí</span>
        </div>

        <header class="kc-card__head">
          <h1><#nested "header"></h1>
        </header>

        <#-- Mensagens de erro/sucesso/aviso -->
        <#if displayMessage && message?has_content && (message.type != 'warning' || !isAppInitiatedAction??)>
          <div class="kc-alert kc-alert--${message.type}" role="alert">
            <span class="kc-alert__text">${kcSanitize(message.summary)?no_esc}</span>
          </div>
        </#if>

        <div class="kc-content">
          <#nested "form">
        </div>

        <#if auth?has_content && auth.showTryAnotherWayLink()>
          <form id="kc-select-try-another-way-form" action="${url.loginAction}" method="post" class="kc-anotherway">
            <input type="hidden" name="tryAnotherWay" value="on"/>
            <a href="#" onclick="document.getElementById('kc-select-try-another-way-form').submit();return false;">${msg("doTryAnotherWay")}</a>
          </form>
        </#if>

        <#if displayInfo>
          <div class="kc-info">
            <#nested "info">
          </div>
        </#if>
      </div>
      <p class="kc-foot">© ${.now?string('yyyy')} Calcula aí · Acesso seguro</p>
    </main>
  </div>

  <script>
    // Mostrar/ocultar senha, progressivo (sem dependências).
    document.querySelectorAll('[data-toggle="password"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var input = btn.parentElement.querySelector('input');
        if (!input) return;
        var toText = input.type === 'password';
        input.type = toText ? 'text' : 'password';
        btn.setAttribute('aria-pressed', String(toText));
        btn.classList.toggle('is-on', toText);
      });
    });
  </script>
</body>
</html>
</#macro>
