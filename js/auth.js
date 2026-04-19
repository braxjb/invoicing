
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");

async function redirectIfLoggedIn() {
  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (session) {
    window.location.href = "/invoices.html";
  }
}

redirectIfLoggedIn();

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  loginMessage.textContent = "Signing in...";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    loginMessage.textContent = error.message;
    return;
  }

  loginMessage.textContent = "Login successful.";
  window.location.href = "/invoices.html";
});