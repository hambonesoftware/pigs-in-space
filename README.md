# Pigs in Space — Cosmic Arcade

A modern, mobile-first, **unofficial fan-made tribute** to Atari's 1983 *Pigs in Space* tripigathlon. Built from scratch for GitHub Pages using HTML5 Canvas, CSS, and plain JavaScript.

## Play online

https://hambonesoftware.github.io/pigs-in-space/

**First-time deployment:** The repository owner may need to enable GitHub Pages under **Settings → Pages → Build and deployment → Source → GitHub Actions**. After that, each push to main publishes the site through .github/workflows/pages.yml. If automatic enablement fails, change the setting and rerun the deployment in the Actions tab.

## Three arcade missions

- **Chickenvaders:** Move left and right, shoot sausages at egg-dropping space chickens, and hit the flying saucer for bonus points. Clear the formation to finish.
- **Pastaroids:** Guide First Mate Piggy through flying spaghetti and meatballs, karate-chop meatballs to earn points, and board the passing Swinetrek before it leaves.
- **Gonzoid Escape:** Fly the Swinetrek through a scrolling pizza mine, avoid the canyon walls and pizza projectiles, destroy the robot defenders with looping Boomerays, and reach the exit.

Gameplay inspiration and scoring rules are based on the original Atari instruction manual, modernized for the web.

## Controls

| Device | Move | Action | Pause |
| --- | --- | --- | --- |
| Phone / tablet | On-screen D-pad or drag on playfield | FIRE / CHOP button | On-screen pause |
| Desktop | Arrows or WASD | Space, J, or Enter | P or Escape |
| Gamepad | D-pad or left stick | A / B | On-screen pause |

Each run has **five shared shields**. Scores, round progression, and increasing difficulty carry across missions. Your local high score and mute preference are saved on the device.

## Features

- Three fully playable original HTML5 Canvas minigames.
- Procedural vector cartoon characters, spaceships, enemies, particles, starfields, responsive high-DPI renderer, and synthesized retro sound effects.
- Portrait/landscape-responsive layout, safe touch controls, keyboard and gamepad support, and automatic pause when the tab is hidden.
- Progressive Web App metadata and offline caching for the app shell after it loads on HTTPS.
- No dependencies to install, analytics, trackers, ROMs, ripped graphics, or recorded copyrighted audio.

## Local development

Open the repository folder using any simple local HTTP server (for example, run python3 -m http.server 8000 and open http://localhost:8000).

| File | Purpose |
| --- | --- |
| index.html | Mission menu, HUD, controls, help dialog |
| styles.css | Mobile-first UI and layout |
| game.js | Original gameplay code, renderer, input, audio, saving |
| manifest.webmanifest | PWA installation metadata |
| sw.js | Offline caching |
| .github/workflows/pages.yml | GitHub Pages workflow |

## Credits & legal

Non-commercial, unofficial fan tribute; no affiliation with Atari, The Muppets, Disney or the Jim Henson Company. Names and characters remain the intellectual property of their respective rights holders. All game code and graphics were independently authored for this project; the original ROM and extracted game assets are not included.

Research sources: [AtariAge manual transcription](https://atariage.com/manual_html_page.php?SoftwareID=1205) and [AtariProtos game overview](https://www.atariprotos.com/2600/software/pigsinspace/pigsinspace.htm).
