const WELCOME_EMAIL_URL = 'https://www.freshlook-ks.com/api/auth/welcome';

export async function sendWelcomeEmail(accessToken: string) {
  try {
    const response = await fetch(WELCOME_EMAIL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.warn('Welcome email request failed', response.status);
    }
  } catch (error) {
    // Email delivery should never prevent a newly created account from opening.
    console.warn('Welcome email request failed', error);
  }
}
