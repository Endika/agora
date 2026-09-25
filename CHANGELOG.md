# Changelog

## [0.23.2](https://github.com/Endika/agora/compare/v0.23.1...v0.23.2) (2026-09-25)


### Bug Fixes

* never drop the visited agoras list on a bad read ([92837ec](https://github.com/Endika/agora/commit/92837ec54d51cf2d8eb7af7cb095505724388ffb))

## [0.23.1](https://github.com/Endika/agora/compare/v0.23.0...v0.23.1) (2026-09-22)


### Bug Fixes

* **sync:** being removed from an agora is not a network failure ([11a4c3d](https://github.com/Endika/agora/commit/11a4c3d0a7ebc7dbcb5bb1cec26f0cede30c8200))
* **ui:** a textarea should not be draggable wider than its page ([c1c2348](https://github.com/Endika/agora/commit/c1c23481535025e25e8f6574e01319c1319575d6))
* **ui:** the radius token never reached the compiled CSS ([a447c1e](https://github.com/Endika/agora/commit/a447c1e294efed60a496aa89d75ee7e8eb48cbb9))

## [0.23.0](https://github.com/Endika/agora/compare/v0.22.0...v0.23.0) (2026-09-22)


### Features

* **board:** carry the agora's ballot mode through the seam ([33e57cd](https://github.com/Endika/agora/commit/33e57cd2e09280eee61822fab7b1b9e01662774f))
* **create:** choose the ballot mode when the agora is born ([f788bcc](https://github.com/Endika/agora/commit/f788bcc211a28d425a76ddc9bf0ce103da41fb1f))
* **privacy:** describe both ballot modes in the notice ([c55dc55](https://github.com/Endika/agora/commit/c55dc555512f562a6c3c22d716a4e4e176aee0f7))
* **sql:** let each agora choose whether its ballot is secret ([1b984ea](https://github.com/Endika/agora/commit/1b984ea552d5d29ce8b222e1615af8029eaed432))
* **vote:** tell the truth about the ballot in both modes ([aa6ef6e](https://github.com/Endika/agora/commit/aa6ef6e3f3eebf2f70a547a9031ac19b4d7cef15))


### Bug Fixes

* **a11y:** make the whole ballot row clickable, not just the dot ([dff1ccb](https://github.com/Endika/agora/commit/dff1ccb03bf0a6e3d5cd46f9054acfa6999ec926))
* **export:** print the count when there is no breakdown to print ([a313f0b](https://github.com/Endika/agora/commit/a313f0bbe33a4d1c7fa6770684a5b55822f2d1c4))
* **privacy:** come back to the board you came from ([4b1f7fc](https://github.com/Endika/agora/commit/4b1f7fc4c4d9e2a79615d116e159632cf48056f5))
* **sql:** empty pending once a secret proposal is resolved ([ec554a5](https://github.com/Endika/agora/commit/ec554a5512c70f7b023e5355287354a95f8db65f))
* **sql:** stop a secret open round leaking its breakdown ([09db1f0](https://github.com/Endika/agora/commit/09db1f089d573e75dff252b44bdf6abe435b4994))
* **sql:** withhold the reveal when a secret ballot is partial ([405e683](https://github.com/Endika/agora/commit/405e683b34ddf107ef0c7ef9a83734cc044c3852))
* **vote:** a withheld ballot has no result to show ([96a63ac](https://github.com/Endika/agora/commit/96a63ac129d7340d68fffb824cd3565b919c31a7))
* **vote:** no verdict when a secret ballot is incomplete ([38b5067](https://github.com/Endika/agora/commit/38b5067b65593abaf92ad59ee3c7bc1efeefe412))
* **vote:** promise the board, not everybody's eyes ([6638b30](https://github.com/Endika/agora/commit/6638b30c0079a58f77d142d2871086e835941a70))
* **vote:** promise what the record carries, not what nobody knows ([da51c55](https://github.com/Endika/agora/commit/da51c551e0d14229c64fe7471129ac6810a01c9d))
* **vote:** say the rule in terms of closing, not of quorum ([c591903](https://github.com/Endika/agora/commit/c591903f5f952f6e6d041b1aad5c9112a1eeea3c))
* **vote:** the past tense promised the same absolute ([196ca1c](https://github.com/Endika/agora/commit/196ca1cfeaf20ee95d549b860da2f72c9695b239))

## [0.22.0](https://github.com/Endika/agora/compare/v0.21.0...v0.22.0) (2026-09-21)


### Features

* **actions:** give the two armed confirmations a way out ([1fbb239](https://github.com/Endika/agora/commit/1fbb23950022301fb7617e507db741addde71254))
* **board:** a side panel on the desktop, the thread above the money ([9161748](https://github.com/Endika/agora/commit/916174872f21cb523d2c2aeca9b2587efce8196e))
* **board:** give vote controls weight and stop card repetition ([724d9b6](https://github.com/Endika/agora/commit/724d9b68da8a6bb48c0b0d5761e397b948dc032a))
* **board:** route the compose and edit sheets and keep the draft ([42df91b](https://github.com/Endika/agora/commit/42df91b0b57f3a64eb556c1a82af6103569b1a69))
* **board:** say the secret ballot and the abstain rule on screen ([361bd6d](https://github.com/Endika/agora/commit/361bd6d5110a998ea967a93ee5ef5f98886e83e4))
* **settings:** add the language and theme pickers ([8e085ab](https://github.com/Endika/agora/commit/8e085ab7034e249f8bb3b16e4ca928258fc81bb0))
* **vote:** confirm the vote, mark your pebble, land the quorum ([666e183](https://github.com/Endika/agora/commit/666e18313f8355a014552c30adea0df85e2ac005))
* **vote:** say the ballot opens at quorum, and show who voted what ([08df872](https://github.com/Endika/agora/commit/08df872048a6b3507ffdec42f78dbe5834c70820))


### Bug Fixes

* **a11y:** AA on filled controls, two columns and focus in the panel ([b24817e](https://github.com/Endika/agora/commit/b24817ebeab78e8dac4080ca10e1aa301efe052c))
* **a11y:** bring the light palette and every filled control to WCAG AA ([27d2d29](https://github.com/Endika/agora/commit/27d2d29a6ab41ca4c86562786e2af487e53e2c9e))
* **a11y:** give dark positive balance its own green ([f046ece](https://github.com/Endika/agora/commit/f046ece80475476b42f01c8c3d4d26ee6c5b99bb))
* **a11y:** make the person switch a 44 px target, like the footer ([7e6edd6](https://github.com/Endika/agora/commit/7e6edd6b95d19b9cd5bef3d5187628ee94387cd6))
* **a11y:** stop sheet focus trap re-arming on parent re-render ([a9a6269](https://github.com/Endika/agora/commit/a9a62692cfe1f0bf1a373d3ccb992a90d637f953))
* **a11y:** strip CSS comments before parsing sync-check tokens ([5f5889c](https://github.com/Endika/agora/commit/5f5889c789c1e52ad0ee7b12362600f22b192f0e))
* **a11y:** trap focus and inert the background while a sheet is open ([a3d35af](https://github.com/Endika/agora/commit/a3d35af0c3c1aa3d0cd45f96f0d75acb0422e8dd))
* **a11y:** write &lt;html lang&gt; at boot, not only from the picker ([32b5a14](https://github.com/Endika/agora/commit/32b5a14e62ea2fc15d29f381bfe3ef7eeb98eea5))
* **board:** case-insensitive delete match, add cancel option ([474b08b](https://github.com/Endika/agora/commit/474b08b37091faf1c5cf7271bed0d8c641d666fd))
* **board:** confirm every destructive action before it runs ([7693763](https://github.com/Endika/agora/commit/76937638d694f0c8691b0d0c65d5140d5f8d5430))
* **board:** leaving the panel always lands the focus on something ([e06d5a6](https://github.com/Endika/agora/commit/e06d5a607e8e2dead5a2c4ce5a1ba4ead229ac57))
* **board:** move the pending-vote label to the button ([4c0157d](https://github.com/Endika/agora/commit/4c0157d5eae9b46c8c60d2ec90fee3ba46f52c68))
* **board:** one voice decides the ballot rule's tense at any width ([963df19](https://github.com/Endika/agora/commit/963df1974a5551079fec2bf38eafa27e61a005c1))
* **board:** restore missing voters, fix a11y and glyph gaps ([91edf18](https://github.com/Endika/agora/commit/91edf182c07608f7abc01dd71363d4d513b38cd7))
* **board:** return to the proposal and keep the draft until it lands ([d5f9e18](https://github.com/Endika/agora/commit/d5f9e1884eeeb779865bd8454a434ec154d10fdb))
* **board:** say the secret ballot once, at board level ([07f4102](https://github.com/Endika/agora/commit/07f41025bb0e03df1f8d7063181512fd4bed87d6))
* **board:** say the secret-ballot rule once beside the panel ([c7b818f](https://github.com/Endika/agora/commit/c7b818fa0742921116efc601eb0dffa17bce7b16))
* **board:** separate sharing, exporting and deleting sections ([0e94aa5](https://github.com/Endika/agora/commit/0e94aa5dbc5beb7c138b0be07e042800fa58bf3f))
* **privacy:** say a resolved vote is published by name, for good ([5cfe2e3](https://github.com/Endika/agora/commit/5cfe2e33da7c363c747fa945f880959d71782d32))
* **styles:** paint the focus ring with a token that clears 3:1 ([5650010](https://github.com/Endika/agora/commit/565001080ad8cd623be6043e98637ac536683c94))
* **vote:** announce into a live region that was already there ([25bd00d](https://github.com/Endika/agora/commit/25bd00d6ba52b4a0ae585a8c433fd8f31db820c4))
* **vote:** explain the open ballot in the past tense too ([24ebb94](https://github.com/Endika/agora/commit/24ebb94f345bb66a8343fd5a5f90b5175c09e77d))
* **vote:** send each confirmation back to the copy it was cast from ([c69f43e](https://github.com/Endika/agora/commit/c69f43e2b349c67aca2de38e096ca5cdecfcf933))


### Performance Improvements

* **bundle:** defer supabase, qrcode and markdown off the entry chunk ([26554b4](https://github.com/Endika/agora/commit/26554b455e7679c99d5930bc9c38a992d5fdfd5c))
* **bundle:** shrink zod with zod/mini and harden the deferrals ([0cc2109](https://github.com/Endika/agora/commit/0cc21097606081a3a20078d0db5847e44e99f9f8))

## [0.21.0](https://github.com/Endika/agora/compare/v0.20.0...v0.21.0) (2026-09-16)


### Features

* **ci:** add CodeQL static analysis ([99023ed](https://github.com/Endika/agora/commit/99023ed9ade782d2bf2ccf1999277da650f8f456))

## [0.20.0](https://github.com/Endika/agora/compare/v0.19.4...v0.20.0) (2026-09-16)


### Features

* **ci:** block PRs that introduce high-severity dependency advisories ([21c34ea](https://github.com/Endika/agora/commit/21c34ea65b11d92fe186e084f15aa94b4b37bbb5))

## [0.19.4](https://github.com/Endika/agora/compare/v0.19.3...v0.19.4) (2026-09-08)


### Chores

* **deps-dev:** bump vitest and @vitest/coverage-v8 to 5.0.0 ([cea0820](https://github.com/Endika/agora/commit/cea08209631758b14441684913a5a7804ce3f339))

## [0.19.3](https://github.com/Endika/agora/compare/v0.19.2...v0.19.3) (2026-09-08)


### Chores

* **deps:** bump the npm-minor-patch group with 13 updates ([df25203](https://github.com/Endika/agora/commit/df2520393ba56b60d8571c864f0caf780ceab8b0))

## [0.19.2](https://github.com/Endika/agora/compare/v0.19.1...v0.19.2) (2026-09-05)


### Chores

* run the four CI gates in pre-commit ([c84cc68](https://github.com/Endika/agora/commit/c84cc68d5249ee9f481ebafacfb450a490643003))

## [0.19.1](https://github.com/Endika/agora/compare/v0.19.0...v0.19.1) (2026-09-05)


### Chores

* **deps:** bump fast-uri in the security-npm group across 1 directory ([3ddfd06](https://github.com/Endika/agora/commit/3ddfd06d184035b4104e354757de6ac7c5b0c64a))
* **deps:** bump the npm-minor-patch group with 13 updates ([1fac19f](https://github.com/Endika/agora/commit/1fac19fd24801c7264f029c2d62fb084d892694d))
* **deps:** bump the npm-minor-patch group with 9 updates ([a49a28a](https://github.com/Endika/agora/commit/a49a28a951bd511b10c7e85c7573d90389521be5))
* run lint, prettier and typecheck over tests too ([0e23197](https://github.com/Endika/agora/commit/0e23197c4956e4009e109fe85388a7bb03ecb7d2))

## [0.19.0](https://github.com/Endika/agora/compare/v0.18.2...v0.19.0) (2026-08-18)


### Features

* **legal:** add the privacy notice and translate server errors ([e646df6](https://github.com/Endika/agora/commit/e646df6876da41e37fb3a285e8a5ac0c8c72987e))

## [0.18.2](https://github.com/Endika/agora/compare/v0.18.1...v0.18.2) (2026-08-18)


### Bug Fixes

* **pwa:** heal a stale cache instead of showing a blank screen ([5c528a8](https://github.com/Endika/agora/commit/5c528a853dba610af51821288dbbcf617b97b6ff))

## [0.18.1](https://github.com/Endika/agora/compare/v0.18.0...v0.18.1) (2026-08-18)


### Bug Fixes

* **db:** let an agora with content actually be deleted ([26c9616](https://github.com/Endika/agora/commit/26c9616d5b7a4fb5776ff994936e04c8f835209c))

## [0.18.0](https://github.com/Endika/agora/compare/v0.17.0...v0.18.0) (2026-08-18)


### Features

* **expense:** pay against your share, and fetch history on demand ([acb9813](https://github.com/Endika/agora/commit/acb9813bc0e79f22fd3ab94945dad3534564d5cd))


### Bug Fixes

* **ui:** put the proposal actions with the proposal ([3ab335b](https://github.com/Endika/agora/commit/3ab335b574461aa39f64d75145c4280975207ee0))

## [0.17.0](https://github.com/Endika/agora/compare/v0.16.3...v0.17.0) (2026-08-18)


### Features

* **board:** compact list rows with the proposal on its own route ([81a443f](https://github.com/Endika/agora/commit/81a443f42ee9d2658968c4b8e97393aa8bf896f0))

## [0.16.3](https://github.com/Endika/agora/compare/v0.16.2...v0.16.3) (2026-08-18)


### Bug Fixes

* **ui:** resolve threads visibly and stop sideways scroll at 320px ([8cf4af0](https://github.com/Endika/agora/commit/8cf4af00a6f65a6c040b59ffed39e6f513f38760))

## [0.16.2](https://github.com/Endika/agora/compare/v0.16.1...v0.16.2) (2026-08-18)


### Bug Fixes

* **expense:** make an amount mean something the moment it is typed ([3fa2d4a](https://github.com/Endika/agora/commit/3fa2d4a6119eeec7684e2d6aaad96cf307fa10e4))

## [0.16.1](https://github.com/Endika/agora/compare/v0.16.0...v0.16.1) (2026-08-18)


### Bug Fixes

* **history:** write real sentences instead of raw types ([9178ba8](https://github.com/Endika/agora/commit/9178ba86b0bcb3d3f98bf700d91cdccb08756d3e))

## [0.16.0](https://github.com/Endika/agora/compare/v0.15.0...v0.16.0) (2026-08-18)


### Features

* **sync:** add offline queue and cached board ([e1d05f9](https://github.com/Endika/agora/commit/e1d05f9b36b4ca380384e077a239a2848cd9dc48))

## [0.15.0](https://github.com/Endika/agora/compare/v0.14.0...v0.15.0) (2026-08-18)


### Features

* **board:** add history, export and an install prompt ([a4c260e](https://github.com/Endika/agora/commit/a4c260e1b52811906dd34535df9c3d0dee9380c4))

## [0.14.0](https://github.com/Endika/agora/compare/v0.13.0...v0.14.0) (2026-08-18)


### Features

* **expense:** add opt-in split and manual liquidation ([c367dc6](https://github.com/Endika/agora/commit/c367dc67dfae134ed9906a8f9c0e28f38069aa19))


### Bug Fixes

* **ui:** surface failed writes instead of swallowing them ([2b5af6f](https://github.com/Endika/agora/commit/2b5af6f93a25c1077942890eace922b5d9798890))

## [0.13.0](https://github.com/Endika/agora/compare/v0.12.1...v0.13.0) (2026-08-18)


### Features

* **threads:** add resolvable comment threads ([f39edb4](https://github.com/Endika/agora/commit/f39edb4b48047578ebe634e6621bae54d39fb9da))

## [0.12.1](https://github.com/Endika/agora/compare/v0.12.0...v0.12.1) (2026-08-18)


### Bug Fixes

* **db:** separate participants sharing a device token ([de602f9](https://github.com/Endika/agora/commit/de602f990b4510cab1c0d46c50960fd5de8862dc))

## [0.12.0](https://github.com/Endika/agora/compare/v0.11.0...v0.12.0) (2026-08-18)


### Features

* **images:** compress, strip exif and show thumbnails ([29ccf64](https://github.com/Endika/agora/commit/29ccf6410f2b1cd9bf41bef7f9ea63f0726ad6b8))

## [0.11.0](https://github.com/Endika/agora/compare/v0.10.0...v0.11.0) (2026-08-18)


### Features

* **proposal:** add editing, archive and a formatting toolbar ([fa47ac7](https://github.com/Endika/agora/commit/fa47ac7ffbe1265ffcae276cfc1cad16134fd977))

## [0.10.0](https://github.com/Endika/agora/compare/v0.9.0...v0.10.0) (2026-08-18)


### Features

* **identity:** pick your name, no pin, and list your agoras ([05f8d48](https://github.com/Endika/agora/commit/05f8d48ffbe169c2b313d66a996a8e242e5ac4c0))

## [0.9.0](https://github.com/Endika/agora/compare/v0.8.1...v0.9.0) (2026-08-18)


### Features

* **proposal:** add form with sanitised markdown and links ([fb5afd6](https://github.com/Endika/agora/commit/fb5afd60ab9b755ff8d57978db1035fd751c04a5))

## [0.8.1](https://github.com/Endika/agora/compare/v0.8.0...v0.8.1) (2026-08-18)


### Bug Fixes

* **pwa:** show a setup notice when supabase config is missing ([aec1cf7](https://github.com/Endika/agora/commit/aec1cf7e77e1004f349181df3b57672da0b87544))

## [0.8.0](https://github.com/Endika/agora/compare/v0.7.0...v0.8.0) (2026-08-18)


### Features

* **board:** add proposal list, voting and tie actions ([3548d3f](https://github.com/Endika/agora/commit/3548d3fc3f1da45afe14b1d35ab5d6f34fa4687f))

## [0.7.0](https://github.com/Endika/agora/compare/v0.6.0...v0.7.0) (2026-08-18)


### Features

* **ui:** add design tokens, icon, psephoi row and join flow ([71afa5c](https://github.com/Endika/agora/commit/71afa5c1b1dcb2f8113488100bc83590c100ef0f))

## [0.6.0](https://github.com/Endika/agora/compare/v0.5.0...v0.6.0) (2026-08-18)


### Features

* **data:** add board repository, cache-first reads and fake ([162d1cd](https://github.com/Endika/agora/commit/162d1cd9b18e798a4f765ec11ba50a28a3d1531f))

## [0.5.0](https://github.com/Endika/agora/compare/v0.4.0...v0.5.0) (2026-08-18)


### Features

* **db:** add rpc layer with server-side pin, quorum and lockdown ([6678062](https://github.com/Endika/agora/commit/6678062b492b34ce8a37af333c75821d138b0535))

## [0.4.0](https://github.com/Endika/agora/compare/v0.3.0...v0.4.0) (2026-08-18)


### Features

* **db:** add agora schema with vote uniqueness constraint ([8be9f35](https://github.com/Endika/agora/commit/8be9f35b458070a487c1ea5f203572bcbdde0d98))


### Bug Fixes

* **db:** apply bootstrap outside the test transaction ([5d43a6e](https://github.com/Endika/agora/commit/5d43a6e1144b9999c61217a594cb23b8ca927c1f))

## [0.3.0](https://github.com/Endika/agora/compare/v0.2.0...v0.3.0) (2026-08-18)


### Features

* **domain:** add quorum resolution, list order and transitions ([88abaa2](https://github.com/Endika/agora/commit/88abaa29a7ed1e62525feb732a5e7293ca59d759))

## [0.2.0](https://github.com/Endika/agora/compare/v0.1.2...v0.2.0) (2026-08-18)


### Features

* **domain:** port money, edit pin and manual liquidation ([8bc7bc7](https://github.com/Endika/agora/commit/8bc7bc716b79f12503f78e4d37c15ee7dc2e6742))

## [0.1.2](https://github.com/Endika/agora/compare/v0.1.1...v0.1.2) (2026-08-18)


### Chores

* **arch:** enforce hexagonal layer boundaries in eslint ([4a68dbd](https://github.com/Endika/agora/commit/4a68dbdab431ef21eff3b148175e46985e7a6e1e))

## [0.1.1](https://github.com/Endika/agora/compare/v0.1.0...v0.1.1) (2026-08-18)


### Chores

* scaffold vite react pwa toolchain ([24d14e8](https://github.com/Endika/agora/commit/24d14e883ae1a2fc48d48445dc0d25e8ca90ea4e))
