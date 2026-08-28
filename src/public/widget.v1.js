(function () {
  var script = document.currentScript;
  if (!script) {
    var scripts = document.getElementsByTagName('script');
    script = scripts[scripts.length - 1];
  }

  var scriptUrl = new URL(script.src);
  var apiOrigin = scriptUrl.origin;
  var publicId = scriptUrl.searchParams.get('id');

  if (!publicId) {
    return;
  }

  function makeId() {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return String(Date.now()) + '-' + Math.random().toString(16).slice(2);
  }

  function setStatus(node, message, isError) {
    node.textContent = message;
    node.style.color = isError ? '#b42318' : '#067647';
  }

  function render(config) {
    var container = document.createElement('div');
    container.setAttribute('data-flyrank-widget', config.id);
    container.style.maxWidth = '420px';
    container.style.border = '1px solid #d0d5dd';
    container.style.padding = '16px';
    container.style.borderRadius = '8px';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.background = config.display_options.theme === 'dark' ? '#101828' : '#ffffff';
    container.style.color = config.display_options.theme === 'dark' ? '#ffffff' : '#101828';

    var title = document.createElement('h2');
    title.textContent = config.title;
    title.style.margin = '0 0 8px';
    title.style.fontSize = '20px';
    container.appendChild(title);

    if (config.description) {
      var description = document.createElement('p');
      description.textContent = config.description;
      description.style.margin = '0 0 14px';
      container.appendChild(description);
    }

    var form = document.createElement('form');
    form.noValidate = true;

    config.fields.forEach(function (field) {
      var wrapper = document.createElement('label');
      wrapper.style.display = 'block';
      wrapper.style.marginBottom = '10px';

      var text = document.createElement('span');
      text.textContent = field.label;
      text.style.display = 'block';
      text.style.marginBottom = '4px';
      wrapper.appendChild(text);

      var input =
        field.type === 'textarea' ? document.createElement('textarea') : document.createElement('input');
      if (field.type !== 'textarea') {
        input.type = field.type === 'email' ? 'email' : 'text';
      }
      input.name = field.name;
      input.required = Boolean(field.required);
      input.maxLength = field.maxLength;
      input.style.width = '100%';
      input.style.boxSizing = 'border-box';
      input.style.padding = '8px';
      input.style.border = '1px solid #d0d5dd';
      input.style.borderRadius = '6px';
      wrapper.appendChild(input);
      form.appendChild(wrapper);
    });

    var honeypot = document.createElement('input');
    honeypot.type = 'text';
    honeypot.name = 'website';
    honeypot.tabIndex = -1;
    honeypot.autocomplete = 'off';
    honeypot.setAttribute('aria-hidden', 'true');
    honeypot.style.position = 'absolute';
    honeypot.style.left = '-10000px';
    form.appendChild(honeypot);

    var button = document.createElement('button');
    button.type = 'submit';
    button.textContent = config.button_text;
    button.style.padding = '10px 14px';
    button.style.border = '0';
    button.style.borderRadius = '6px';
    button.style.background = '#155eef';
    button.style.color = '#ffffff';
    button.style.cursor = 'pointer';
    form.appendChild(button);

    var status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.style.margin = '10px 0 0';

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      button.disabled = true;
      setStatus(status, 'Submitting...', false);

      var formData = new FormData(form);
      var submittedData = {};
      config.fields.forEach(function (field) {
        submittedData[field.name] = formData.get(field.name) || '';
      });

      fetch(apiOrigin + '/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          public_id: config.id,
          idempotency_key: makeId(),
          website: formData.get('website') || '',
          submitted_data: submittedData
        })
      })
        .then(function (response) {
          return response.json().then(function (body) {
            if (!response.ok) {
              throw new Error(body.error && body.error.message ? body.error.message : 'Submission failed');
            }
            return body;
          });
        })
        .then(function () {
          form.reset();
          setStatus(status, 'Thanks. Your submission was received.', false);
        })
        .catch(function (error) {
          setStatus(status, error.message || 'Submission failed', true);
        })
        .finally(function () {
          button.disabled = false;
        });
    });

    container.appendChild(form);
    container.appendChild(status);
    script.parentNode.insertBefore(container, script.nextSibling);
  }

  fetch(apiOrigin + '/widgets/' + encodeURIComponent(publicId) + '/config')
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Widget config could not be loaded');
      }
      return response.json();
    })
    .then(render)
    .catch(function (error) {
      console.error('[FlyRank widget]', error.message);
    });
})();

