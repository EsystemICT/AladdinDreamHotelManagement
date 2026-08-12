# Aladdin Dream Hotel Management

## Firebase Authentication setup

Password login and recovery use Firebase Authentication email/password accounts.

The application intentionally uses two Firebase projects: operational hotel records remain in the `hotel-ops-system` Firestore database, while email/password authentication and password-reset emails use `new-portal-14fcc`.

1. Open Firebase Console for the `new-portal-14fcc` project.
2. Go to **Authentication > Sign-in method**.
3. Enable **Email/Password** (the first option, not email-link-only sign-in).
4. Under **Authentication > Templates > Password reset**, set the sender name and email text used for the hotel.
5. Under **Authentication > Settings > Authorized domains**, include every domain that hosts this app.

Existing Firestore-only accounts are migrated automatically on their next valid login or password-reset request. Once migrated, their plaintext `password` field is removed from Firestore. New staff accounts are created in Firebase Authentication immediately and require a valid recovery email.

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
