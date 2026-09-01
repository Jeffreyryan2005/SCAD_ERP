/**
 * SCAD ERP - Change Password Page Logic
 * Self-service password change with security question verification.
 */
(function () {
    'use strict';

    function updatePasswordRules(password, username) {
        var rulesEl = document.getElementById('pwd-rules');
        var barEl = document.getElementById('pwd-strength-bar');
        var textEl = document.getElementById('pwd-strength-text');

        var checks = [
            { test: password.length >= 8, label: '8+ characters' },
            { test: /[A-Z]/.test(password), label: 'Uppercase letter' },
            { test: /[a-z]/.test(password), label: 'Lowercase letter' },
            { test: /[0-9]/.test(password), label: 'A digit (0-9)' },
            { test: !username || password.toLowerCase() !== username.toLowerCase(), label: 'Not same as username' }
        ];

        var passed = 0;
        var html = '';
        checks.forEach(function(c) {
            if (c.test) {
                passed++;
                html += '<span class="pass">\u2713 ' + c.label + '</span>';
            } else {
                html += '<span class="fail">\u2717 ' + c.label + '</span>';
            }
        });
        rulesEl.innerHTML = html;

        var pct = (passed / checks.length) * 100;
        barEl.style.width = pct + '%';
        if (pct <= 40) { barEl.style.background = '#C62828'; textEl.textContent = 'Weak'; }
        else if (pct <= 80) { barEl.style.background = '#F57C00'; textEl.textContent = 'Medium'; }
        else { barEl.style.background = '#2E7D32'; textEl.textContent = 'Strong'; }
    }

    document.addEventListener('DOMContentLoaded', function () {
        if (window.Theme) window.Theme.init();

        var user = window.Auth ? window.Auth.getCurrentUser() : null;
        if (!user) {
            window.location.href = 'index.html';
            return;
        }

        // Show security question field if user has one set
        var secQSection = document.getElementById('security-q-section');
        var secQLabel = document.getElementById('security-q-label');
        if (secQSection && window.Auth.hasSecurityQuestion(user.username)) {
            var question = window.Auth.getSecurityQuestionForUser(user.username);
            secQLabel.textContent = question;
            secQSection.style.display = 'block';
        }

        // Live password strength
        document.getElementById('new-pwd').addEventListener('input', function () {
            updatePasswordRules(this.value, user.username);
        });

        // Form submit
        document.getElementById('change-pwd-form').addEventListener('submit', function (e) {
            e.preventDefault();

            var currentPwd = document.getElementById('current-pwd').value;
            var newPwd = document.getElementById('new-pwd').value;
            var confirmPwd = document.getElementById('confirm-pwd').value;
            var errEl = document.getElementById('pwd-error');
            var successEl = document.getElementById('pwd-success');

            errEl.style.display = 'none';
            successEl.style.display = 'none';

            if (newPwd !== confirmPwd) {
                errEl.textContent = 'Passwords do not match';
                errEl.style.display = 'block';
                return;
            }

            // Verify security answer if user has one
            if (window.Auth.hasSecurityQuestion(user.username)) {
                var secAnswer = document.getElementById('security-answer');
                if (secAnswer && !window.Auth.verifySecurityAnswer(user.username, secAnswer.value)) {
                    errEl.textContent = 'Incorrect security answer. Password change denied.';
                    errEl.style.display = 'block';
                    return;
                }
            }

            var result = window.Auth.changePassword(currentPwd, newPwd);
            if (result.success) {
                successEl.textContent = 'Password changed successfully! Redirecting...';
                successEl.style.display = 'block';
                document.getElementById('change-pwd-form').reset();
                document.getElementById('pwd-rules').innerHTML = '';
                document.getElementById('pwd-strength-bar').style.width = '0';
                document.getElementById('pwd-strength-text').textContent = '';

                setTimeout(function () {
                    window.location.href = window.Auth.getRedirectForRole(user.role);
                }, 1500);
            } else {
                errEl.textContent = result.error;
                errEl.style.display = 'block';
            }
        });
    });
})();
