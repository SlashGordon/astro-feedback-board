# astro-feedback-board

Anonymous, moderated feedback for Astro sites. Visitors post feedback without an account, an admin approves it in a small panel, and one Cloudflare Worker serves all sites.

The package has the Astro components. They talk to the Worker from the [repository](https://github.com/SlashGordon/astro-feedback-board), which you deploy once to your own Cloudflare account. The [main README](https://github.com/SlashGordon/astro-feedback-board#readme) explains the setup.

## Install

```sh
npm install astro-feedback-board
```

## Components

- `<FeedbackButton />`: a floating or inline button that opens the feedback form.
- `<FeedbackAsk />`: a question card with the form, for example under an article.
- `<FeedbackBoard />`: the public board with votes, replies, filters and the visitor's own posts.
- `<FeedbackComments />`: dev.to-style reactions and moderated comments for an article.
- `<FeedbackPrompt />`: asks for feedback after some minutes of active use.

```astro
---
import { FeedbackBoard, FeedbackButton } from "astro-feedback-board/components";
---

<FeedbackButton site="my-site" endpoint="https://feedback.example.com" lang="de" boardUrl="/feedback" />
<FeedbackBoard site="my-site" endpoint="https://feedback.example.com" lang="de" />
```

Every component takes `site`, `endpoint`, `lang` (`de`, `en`, `es`), `context`, `privacyUrl` and `strings`. The [main README](https://github.com/SlashGordon/astro-feedback-board#using-the-components) lists the props of each component.

## Privacy

The components set no cookies and load no third-party scripts or fonts. They write to localStorage only after the visitor asks for it. The [privacy section](https://github.com/SlashGordon/astro-feedback-board#privacy) lists what the Worker stores and for how long, and [docs/datenschutz.md](https://github.com/SlashGordon/astro-feedback-board/blob/main/docs/datenschutz.md) is a German template for your privacy policy.

## License

[MIT](./LICENSE) © [SlashGordon](https://www.slashgordon.link).

