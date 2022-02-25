const messagesDiv = document.getElementById('messages');
const messageForm = document.getElementById('message-form');
const messageTemplate = document.getElementById('message-template');

let STATE = {
  username: '',
  connected: false,
  messages: [],
}

function hashColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }

  return `hsl(${hash % 360}, 100%, 87%)`;
}

function renderMessage({ username, message }) {
  const node = messageTemplate.content.cloneNode(true);
  node.querySelector('.message').classList.add(username === STATE.username ? 'me' : 'not-me');
  node.querySelector('.username').textContent = username;
  node.querySelector('.message').style.backgroundColor = hashColor(username);
  node.querySelector('.text').textContent = message;
  messagesDiv.prepend(node);
}

function addMessage(data) {
  STATE.messages.push(data);
  renderMessage(data);
  window.localStorage.setItem('state', JSON.stringify(STATE));
}

function setConnectedStatus(status) {
  STATE.connected = status;
  messageForm.className = status ? 'connected' : 'reconnecting';
}

function init() {
  try {
    const { username, messages } = JSON.parse(window.localStorage.getItem('state'));
    STATE = { ...STATE, username, messages };
    STATE.messages.forEach(renderMessage);
    messageForm.username.value = username;
    console.info('loaded local state');
  } catch(e) {
    console.info('could not load previous state');
    addMessage({ username: 'system', message: 'Welcome!' });
  }

  messageForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const formData = new FormData(messageForm);
    STATE.username = formData.get('username');

    if (STATE.connected) {
      fetch('/message', {
        method: 'POST',
        body: new URLSearchParams(formData),
      }).then(() => {
        messageForm.message.value = '';
      });
    }
  });

  let retryTime = 1;

  function connect() {
    const uri = '/events';
    const events = new EventSource(uri);

    events.addEventListener('message', (ev) => {
      try {
        const { message, username } = JSON.parse(ev.data);
        addMessage({ username, message });
      } catch (e) {
        console.error(e);
      }
    });

    events.addEventListener('open', () => {
      setConnectedStatus(true);
      console.log(`connected to event stream at ${uri}`);
      retryTime = 1;
    });

    events.addEventListener('error', () => {
      setConnectedStatus(false);
      events.close();

      const timeout = retryTime;
      retryTime = Math.min(64, retryTime * 2);
      console.log(`connection lost. attempting to reconnect in ${timeout}s`);
      setTimeout(() => connect(), (() => timeout * 1000)());
    });
  }

  connect();
}

init();
