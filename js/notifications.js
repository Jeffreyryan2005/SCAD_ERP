(function () {
    'use strict';

    window.NotificationsPage = {
        user: null,
        notifications: [],

        init: function () {
            this.user = window.Auth ? window.Auth.getCurrentUser() : null;
            if (!this.user) {
                window.location.href = 'index.html';
                return;
            }

            // Theme init
            if (window.Theme) window.Theme.init();

            // Mark all read button
            var markAllBtn = document.getElementById('mark-all-read-btn');
            if (markAllBtn) markAllBtn.addEventListener('click', this.markAllRead.bind(this));

            this.loadNotifications();
        },

        loadNotifications: function () {
            var userId = this.user.facultyId || this.user.username;
            var storageKey = 'scad_notifications_' + userId;
            this.notifications = JSON.parse(localStorage.getItem(storageKey) || '[]');
            this.render();
        },

        render: function () {
            var list = document.getElementById('notifications-list');
            if (!list) return;

            if (this.notifications.length === 0) {
                list.innerHTML = '<div style="text-align:center; padding: 3rem; color: var(--color-text-muted)"><p style="font-size:2rem; margin-bottom:0.5rem"></p><p>No notifications yet.</p></div>';
                return;
            }

            var html = '';
            this.notifications.forEach(function(n) {
                var unreadClass = n.read ? '' : 'unread';
                var timeStr = new Date(n.timestamp).toLocaleString();
                
                html += '<div class="notification-card ' + (n.type || 'info') + ' ' + unreadClass + '">' +
                    '<div class="notification-content">' +
                        '<h3>' + n.title + '</h3>' +
                        '<p>' + n.message + '</p>' +
                        '<div class="notification-meta">' +
                            'From: ' + (n.from || 'System') + ' &bull; ' + timeStr +
                        '</div>' +
                    '</div>' +
                    '<div class="notification-actions">' +
                        (!n.read ? '<button class="btn btn--sm btn--outline" onclick="window.NotificationsPage.markRead(' + n.id + ')">Mark Read</button>' : '') +
                        '<button class="btn btn--sm btn--danger" onclick="window.NotificationsPage.deleteNotification(' + n.id + ')">Delete</button>' +
                    '</div>' +
                '</div>';
            });

            list.innerHTML = html;
        },

        save: function() {
            var userId = this.user.facultyId || this.user.username;
            var storageKey = 'scad_notifications_' + userId;
            localStorage.setItem(storageKey, JSON.stringify(this.notifications));
            this.render();
        },

        markRead: function(id) {
            var notif = this.notifications.find(function(n) { return n.id === id; });
            if (notif) {
                notif.read = true;
                this.save();
            }
        },

        deleteNotification: function(id) {
            this.notifications = this.notifications.filter(function(n) { return n.id !== id; });
            this.save();
        },

        markAllRead: function() {
            this.notifications.forEach(function(n) { n.read = true; });
            this.save();
        }
    };

    document.addEventListener('DOMContentLoaded', function() {
        window.NotificationsPage.init();
    });

})();
