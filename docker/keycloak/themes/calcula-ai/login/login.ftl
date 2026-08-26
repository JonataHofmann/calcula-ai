<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=!messagesPerField.existsError('username','password') displayInfo=(realm.password && realm.registrationAllowed && !registrationDisabled??); section>
  <#if section = "header">
    ${msg("loginAccountTitle")}
  <#elseif section = "form">
    <#if realm.password>
      <form id="kc-form-login" class="kc-form" onsubmit="login.disabled = true; return true;" action="${url.loginAction}" method="post">
        <div class="kc-field">
          <label for="username">
            <#if !realm.loginWithEmailAllowed>${msg("username")}<#elseif !realm.registrationEmailAsUsername>${msg("usernameOrEmail")}<#else>${msg("email")}</#if>
          </label>
          <input tabindex="1" id="username" name="username" value="${(login.username!'')}" type="text"
                 autofocus autocomplete="username" spellcheck="false"
                 aria-invalid="<#if messagesPerField.existsError('username','password')>true</#if>"/>
        </div>

        <div class="kc-field">
          <label for="password">${msg("password")}</label>
          <div class="kc-password">
            <input tabindex="2" id="password" name="password" type="password" autocomplete="current-password"
                   aria-invalid="<#if messagesPerField.existsError('username','password')>true</#if>"/>
            <button class="kc-password__toggle" type="button" data-toggle="password"
                    aria-label="${msg('showPassword')}" aria-pressed="false">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/></svg>
            </button>
          </div>
          <#if messagesPerField.existsError('username','password')>
            <span class="kc-error" aria-live="polite">
              ${kcSanitize(messagesPerField.getFirstError('username','password'))?no_esc}
            </span>
          </#if>
        </div>

        <div class="kc-row">
          <#if realm.rememberMe && !usernameHidden??>
            <label class="kc-check">
              <input tabindex="3" id="rememberMe" name="rememberMe" type="checkbox" <#if login.rememberMe??>checked</#if>/>
              <span>${msg("rememberMe")}</span>
            </label>
          <#else>
            <span></span>
          </#if>
          <#if realm.resetPasswordAllowed>
            <a class="kc-link" tabindex="5" href="${url.loginResetCredentialsUrl}">${msg("doForgotPassword")}</a>
          </#if>
        </div>

        <input type="hidden" id="id-hidden-input" name="credentialId"
               <#if auth.selectedCredential?has_content>value="${auth.selectedCredential}"</#if>/>
        <button tabindex="4" class="kc-submit" name="login" id="kc-login" type="submit">${msg("doLogIn")}</button>
      </form>
    </#if>

    <#if realm.password && social.providers?? && social.providers?has_content>
      <div class="kc-sep"><span>${msg("identity-provider-login-label")}</span></div>
      <div class="kc-social">
        <#list social.providers as p>
          <a class="kc-social__btn" href="${p.loginUrl}" id="social-${p.alias}">
            <#if p.iconClasses?has_content><i class="${p.iconClasses}" aria-hidden="true"></i></#if>
            <span>${p.displayName!}</span>
          </a>
        </#list>
      </div>
    </#if>

  <#elseif section = "info">
    <#if realm.password && realm.registrationAllowed && !registrationDisabled??>
      <div class="kc-register">
        <span>${msg("noAccount")}</span>
        <a tabindex="6" class="kc-link" href="${url.registrationUrl}">${msg("doRegister")}</a>
      </div>
    </#if>
  </#if>
</@layout.registrationLayout>
