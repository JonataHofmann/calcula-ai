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
  <link rel="icon"
        href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%233730c9'/%3E%3Ctext x='16' y='22' font-size='18' font-family='Arial' font-weight='bold' fill='white' text-anchor='middle'%3EC%3C/text%3E%3C/svg%3E">
  <#if properties.styles?has_content>
    <#list properties.styles?split(' ') as style>
      <link href="${url.resourcesPath}/${style}" rel="stylesheet"/>
    </#list>
  </#if>
</head>
<body class="kc-body ${bodyClass}">
  <div class="kc-shell">
    <aside class="kc-brand" aria-hidden="true">
      <div class="kc-brand__inner">
        <div class="kc-brand__logo">
          <svg width="40" height="40" viewBox="0 0 32 32" role="img"><rect width="32" height="32" rx="9" fill="#ffffff"/><text x="16" y="23" font-size="19" font-family="Inter, Arial, sans-serif" font-weight="800" fill="#3730c9" text-anchor="middle">C</text></svg>
          <span>Calcula aí</span>
        </div>
        <h2 class="kc-brand__title">Suas finanças, sob controle.</h2>
        <p class="kc-brand__text">Importe faturas, categorize com IA e acompanhe cada centavo em um só lugar.</p>
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
