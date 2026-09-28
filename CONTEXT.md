# Domain glossary

Terms used in the code and in reviews.

## Domain

- **Site**: a website registered in the admin panel. It has one or more origins and its own moderation settings.
- **Post**: a row in `posts`. A post without a parent is **feedback**, a post with a parent is a **reply**.
- **Kind**: `feedback`, `idea` or `bug`. Only feedback has a kind.
- **Article**: a page that takes comments and reactions, named by its article key (usually the path, `/blog/hello`).
- **Comment**: a top-level post with an article key. It is moderated like feedback but never appears on the board.
- **Reaction**: like, unicorn, mind blown, clap or fire on an article, as on dev.to. Each reactor can toggle each reaction once. Not moderated.
- **Activity prompt**: the card that asks for feedback after some minutes of active use. Dismissing it snoozes it.
- **Topic status**: the admin's progress on feedback: `open`, `planned`, `in_progress`, `done`, `declined`.
- **Post status**: the moderation state of any post: `pending`, `approved`, `rejected`, `spam`.
- **Queue**: all pending posts, across sites.
- **Paused site**: the kill switch. Every write (posts, votes, reactions) answers 503 `site_paused`. Reading still works.
- **Daily IP hash**: sha256 of the IP with a random salt per UTC day. The salt sits in `ip_salts` and the cron deletes it after two days. The hash is the rate-limit key and the vote key of visitors without a device token. Posts, votes, reactions and the daily post count (`post_quota`) keep it for two days for the per-IP caps.
- **Forgetting a device**: `DELETE /v1/me` deletes the device's posts, reactions, read markers, callsign and trust. The client then clears its `afb:` keys.
- **Moderation mode**: per site and separately for feedback, replies and comments: `all`, `untrusted` or `none`.
- **Device**: a visitor's browser, identified by its **author hash** (`sha256` of the token in localStorage).
- **Callsign**: the public name of a device on one site, like "Lunar Otter 42". Shown when a post has no nickname. Each device gets the next number on a site with its first post there. A Feistel permutation keyed by the site id turns the number into the name, so no two devices on a site share a callsign and it never changes.
- **Trusted device**: a device whose posts skip the queue where the mode is `untrusted`. Trust is manual or automatic, for one site or all sites, permanent or with an expiry date.
- **Team reply**: a reply written in the admin panel. Always approved, shown with the verified badge.
- **Reply badge**: the number of approved replies by others in threads the visitor posted in, since they last opened the thread. Driven by `approved_at` and the `seen` table.

## Modules

- **Protocol** (`packages/astro/src/protocol.ts`): the values, content rules and JSON shapes both the Worker and the components use.
- **Post lifecycle** (`worker/src/posts.ts`): the only writer of the `posts` table. Decides the initial status, moderates, requeues and deletes.
- **Trust** (`worker/src/trust.ts`): grants, revokes and checks trusted devices.
- **Comments** (`worker/src/comments.ts`): the comments and reactions of one article.
- **Board views** (`worker/src/board.ts`): what the public board reads: lists, threads, votes and the visitor's own posts.
- **Route table** (`worker/src/router.ts`): routes with their guards (target site or feedback, origin check, paused site, rate limit).
- **Visitor session** (`packages/astro/src/client/visitor.ts`): the device token, the nickname, prompt snoozes and the visitor's own posts in the browser. Badges and boards watch it instead of fetching on their own.
- **Activity clock** (`packages/astro/src/client/activity.ts`): counts active time for the activity prompt.
- **Challenge solver** (`packages/astro/src/client/challenge.ts`): solves ALTCHA challenges in the background for forms and reactions.
- **Callsigns** (`worker/src/callsign.ts`): hands out device numbers per site and turns them into callsigns.
- **Daily IP hash** (`worker/src/ip.ts`): creates, caches and deletes the daily salts.
- **Notifications** (`worker/src/notify.ts`): the ntfy push for new posts.
