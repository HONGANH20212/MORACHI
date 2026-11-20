document.addEventListener('DOMContentLoaded', () => {
    const trigger = document.getElementById('mobile-contact');
    if (!trigger) return;

    const mobile = window.matchMedia('(max-width: 768px)');
    const panel = document.createElement('div');
    panel.id = 'morachi-contact-list';
    panel.className = 'morachi-contact-popover';
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', 'Liên hệ MORACHI');
    panel.hidden = true;
    document.body.append(panel);

    function closeContacts(restoreFocus = false) {
        panel.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        if (restoreFocus) trigger.focus({ preventScroll: true });
    }

    function appendContact(source, label, iconClass, color) {
        const link = document.createElement('a');
        link.href = source.href;
        link.className = 'morachi-contact-pill';
        if (source.target === '_blank') {
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
        }
        const text = document.createElement('span');
        text.textContent = label;
        const badge = document.createElement('span');
        badge.className = 'morachi-contact-badge';
        badge.style.backgroundColor = color;
        badge.setAttribute('aria-hidden', 'true');
        const icon = document.createElement('i');
        icon.className = iconClass;
        badge.append(icon);
        link.append(text, badge);
        panel.append(link);
    }

    function renderContacts() {
        panel.replaceChildren();
        const seen = new Set();
        document.querySelectorAll('.floating-contact a').forEach(source => {
            const service = source.classList.contains('btn-messenger') ? 'messenger'
                : source.classList.contains('btn-facebook') ? 'facebook'
                : source.classList.contains('btn-tiktok1') ? 'tiktok1'
                : source.classList.contains('btn-tiktok2') ? 'tiktok2' : '';
            if (!service || seen.has(service + source.href)) return;
            seen.add(service + source.href);
            if (service === 'messenger') {
                appendContact(source, 'Messenger', 'fa-brands fa-facebook-messenger', '#0084ff');
            } else if (service === 'facebook') {
                appendContact(source, 'Facebook', 'fa-brands fa-facebook-f', '#1877f2');
            } else {
                const label = source.querySelector('.tooltip')?.textContent.trim();
                appendContact(source, label ? 'TikTok · ' + label : 'TikTok', 'fa-brands fa-tiktok', '#191919');
            }
        });
        const phone = document.querySelector('#mobile-menu a[href^="tel:"]');
        if (phone) appendContact(phone, 'Gọi shop', 'fa-solid fa-phone', '#258955');
    }

    trigger.addEventListener('click', () => {
        if (!mobile.matches) return;
        if (!panel.hidden) {
            closeContacts();
            return;
        }
        renderContacts();
        if (!panel.childElementCount) return;
        panel.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
    });

    document.addEventListener('pointerdown', event => {
        if (!panel.contains(event.target) && !trigger.contains(event.target)) closeContacts();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !panel.hidden) closeContacts(true);
    });
    panel.addEventListener('click', event => {
        if (event.target.closest('a')) closeContacts();
    });
    panel.addEventListener('focusout', event => {
        if (!panel.contains(event.relatedTarget) && !trigger.contains(event.relatedTarget)) closeContacts();
    });
    mobile.addEventListener('change', () => closeContacts());

    document.body.classList.add('morachi-contact-ready');
});
