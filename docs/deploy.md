# Deploying the Worker

This guide sets up the Worker on your own Cloudflare account and connects a first site. The examples use `feedback.example.com` for the Worker and `https://www.example.com` for the site. Replace both with your own domains.

You need:

- a Cloudflare account,
- a domain whose DNS zone is in the same Cloudflare account, for the Worker's custom domain,
- Node.js and a clone of this repository.

All commands run in `worker/` unless a step says otherwise.

## 1. Install and log in

```sh
npm install
cd worker
npx wrangler login
```

## 2. Create a private config

`worker/wrangler.jsonc` is the template in the repository. Keep your database ID and Access values out of it and work with a copy. The repository's `.gitignore` already ignores `worker/wrangler.prod.jsonc`.

```sh
cp wrangler.jsonc wrangler.prod.jsonc
```

Change the route in `wrangler.prod.jsonc` to your domain:

```jsonc
"routes": [{ "pattern": "feedback.example.com", "custom_domain": true }],
```

Pass `-c wrangler.prod.jsonc` to every wrangler command from here on. Without it, wrangler reads the template.

## 3. Create the database

```sh
npx wrangler d1 create feedback --jurisdiction eu -c wrangler.prod.jsonc
```

`--jurisdiction eu` keeps the stored data in the EU. The privacy template in [datenschutz.md](datenschutz.md) assumes it.

Copy the printed `database_id` into the existing `DB` entry in `wrangler.prod.jsonc`, in place of `REPLACE_WITH_D1_DATABASE_ID`. Wrangler may also append a second entry for the new database to the config. The Worker only reads the `DB` binding, so remove that extra entry. `npx wrangler d1 list` shows the ID again later.

Then create the tables:

```sh
npx wrangler d1 migrations apply feedback --remote -c wrangler.prod.jsonc
```

## 4. Deploy and set the secret

```sh
npx wrangler deploy -c wrangler.prod.jsonc
openssl rand -base64 48 | npx wrangler secret put ALTCHA_HMAC_KEY -c wrangler.prod.jsonc
```

`ALTCHA_HMAC_KEY` signs the proof-of-work challenges, so set it right after the first deploy. The first deploy also creates the custom domain and its certificate, which can take a few minutes. Check the Worker:

```sh
curl https://feedback.example.com/
# astro-feedback-board
```

The admin panel answers 403 until step 5 is done, so the Worker is safe to leave running in between.

## 5. Protect the admin panel with Cloudflare Access

The Worker checks the Access token on every `/admin` request itself and answers 403 without a valid one.

1. In the Cloudflare dashboard, open Zero Trust. Under Settings, note your team domain, for example `https://myteam.cloudflareaccess.com`.
2. Under Access, Applications, add a self-hosted application with the domain `feedback.example.com` and the path `admin*`.
3. Add a policy with the action Allow and include your own email address.
4. Open the application and copy its Application Audience (AUD) tag.
5. Put both values into `wrangler.prod.jsonc`:

   ```jsonc
   "ACCESS_TEAM_DOMAIN": "https://myteam.cloudflareaccess.com",
   "ACCESS_AUD": "<AUD tag>",
   ```

6. Deploy again: `npx wrangler deploy -c wrangler.prod.jsonc`

Open `https://feedback.example.com/admin`. After the Access login, the admin panel loads.

## 6. Register your site

In the admin panel, open Sites and click "Neue Site":

- ID: a short name such as `example`. The components use it as the `site` prop.
- Name: shown in the admin panel and in notifications.
- Origins: every origin the site is served from, separated by spaces, for example `https://www.example.com https://example.com`. The Worker compares the browser's `Origin` header character by character, so the scheme and `www` must match.

The moderation fields default to "all", so every post waits in the queue until you approve it. The same form has the pause switch, which stops all posts, votes and reactions on the site.

Don't add `http://localhost:4321` to a production site. For local testing, run the Worker locally (see [Local testing](#local-testing)).

## 7. Optional: notifications with ntfy

Set `NTFY_URL` in `wrangler.prod.jsonc` to a topic with a long random name, for example `https://ntfy.sh/feedback-3f9c2a7e5b1d`, and deploy again. If the topic needs a token:

```sh
npx wrangler secret put NTFY_TOKEN -c wrangler.prod.jsonc
```

The push contains the site, the kind of post and a link to the admin panel. With `NTFY_INCLUDE_TEXT` set to `"true"` it also contains the post text, which then goes to the ntfy server. Mention ntfy in your privacy policy if you turn it on.

## 8. Connect your site

1. Install the components in the site: `npm install astro-feedback-board`
2. Add the components with your site ID and Worker URL, as shown in the [README](../README.md#using-the-components).
3. If the site sends a Content Security Policy, add the Worker to `connect-src`, for example `connect-src 'self' https://feedback.example.com`. Otherwise the browser blocks every request to the Worker.
4. Pass `privacyUrl` to the components and add the section from [datenschutz.md](datenschutz.md) to your privacy policy.

Deploy the site, send a test post and approve it in the queue.

## Local testing

In this repository, `npm run dev` starts the Worker on `http://localhost:8787` with a local database and opens `/admin` without Access. Add your site there with the origin of its dev server, for example `http://localhost:4321`, and point the site's `endpoint` prop at `http://localhost:8787`.

## Updating

```sh
git pull
npm install
cd worker
npx wrangler d1 migrations apply feedback --remote -c wrangler.prod.jsonc
npx wrangler deploy -c wrangler.prod.jsonc
```

Wrangler records which migrations ran and applies only new ones.

## Troubleshooting

`Invalid property: databaseId => Invalid uuid [code: 7400]`: the config still has `REPLACE_WITH_D1_DATABASE_ID`, or the command ran without `-c wrangler.prod.jsonc`. Copy the ID from `npx wrangler d1 list` into the `DB` entry.

`git status` shows `worker/wrangler.jsonc` as changed after a wrangler command: the command ran without `-c` and wrangler wrote into the template, sometimes with your database ID. Move the values you need into `wrangler.prod.jsonc` and run `git checkout -- worker/wrangler.jsonc`.

`403 origin_not_allowed` in the browser console: the page's origin is not in the site's origin list. Compare it with the address bar, including `www` and `https`.

The browser console reports a Content Security Policy violation for the Worker URL: the Worker is missing from `connect-src` on the site.

Posts, votes and reactions fail in the browser with a CORS error, while `curl` requests work: Cloudflare Access answers the CORS preflight with 403 before it reaches the Worker. This happens when another Access application also covers the Worker's hostname, for example a wildcard application for `*.example.com`. Check with

```sh
curl -s -o /dev/null -w '%{http_code}\n' -X OPTIONS -H 'Origin: https://www.example.com' \
  -H 'Access-Control-Request-Method: POST' https://feedback.example.com/v1/challenge
```

It must print `204`. To fix a `403`, add a self-hosted application for `feedback.example.com` without a path, with a Bypass policy for Everyone and "Bypass options requests to origin" turned on in its CORS settings. The most specific application wins, so `/admin*` keeps its login and the wildcard no longer applies to the Worker. Leave the other CORS fields empty: the Worker sends CORS headers only to registered origins.

`/admin` answers 403 after logging in: `ACCESS_TEAM_DOMAIN` or `ACCESS_AUD` is empty or wrong, or the Worker was not deployed again after setting them.

`400 altcha_invalid` on every post: `ALTCHA_HMAC_KEY` was changed while a form was open. Reload the page.
