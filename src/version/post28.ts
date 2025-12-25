import { getAllPaths, now, randomLetters, RoutingInfo, serverConsoleLog, serverLog, shortenName } from "../utils.ts";
import { getPlayer } from "../db.ts";
import { serverConfig, gameConfig } from "../config.ts";
import { MexpSession, MexpUser } from "../user.ts";
import { Captcha, captchas } from "../captcha.ts";
import { mexp_allowed, mexp_version, m_ga, m_dl, m_gg, m_gm, m_gt, m_sd, m_vi, m_wl, m_gn, m_sg, m_pc, m_cp, m_gp, m_gs, m_ss, m_st, m_im, m_tv } from "./shared.ts";

export async function doRouting(info:RoutingInfo) {
  const req:Request = info.req;
  const path:string = info.path;
  const user:MexpUser|null = info.user;
  const session:MexpSession|null = info.session;
  const me:string = info.me;
  const au:boolean = info.au;

  switch (path)
  {
    case `/${serverConfig.data}/allowed`: {
      return mexp_allowed();
    }
    case `/${serverConfig.data}/version`: {
      return mexp_version();
    }
    case "/m/m/d": {
      return m_dl();
    }
    case "/m/m/c": {
      if (gameConfig.version >= 36) {
        const captcha = new Captcha();
        captchas.push(captcha);
        
        return new Response(await captcha.generateImage(), {
          status: 200,
          headers: {
            "content-type": "image/png; charset=binary",
          },
        });
      } else {
        return new Response("404");
      }
    }
    case "/m/u/c": {
      if (gameConfig.version >= 36) {
        const ca = req.headers.get("ca") ?? "wrong";
        for (const captcha of captchas) {
          if (captcha.answer == ca) {
            const newMe = randomLetters(64);
            
            const player:MexpUser|null = getPlayer(newMe, false, false);
            if (!player) {
              return new Response("0");
            }

            serverLog(`new user: ${player.username}`, false);
            
            return new Response(newMe);
          }
        }
        return new Response("0");
      } else {
        return new Response("404");
      }
    }
    case "/m/u/v": {
      return m_vi(req, me, au);
    }
    case "/m/u/t": {
      return m_gt(user);
    }
    case "/m/u/s": {
      return m_sd(user);
    }
    case "/m/m/w": {
      return await m_wl(user);
    }
    case "/m/m/m": {
      return await m_gm(req, user, session, me, au);
    }
    case "/m/o/g": {
      return m_gg(user);
    }
    case "/m/n/a": {
      return await m_ga(user);
    }
    case "/m/n/n": {
      return await m_gn(user);
    }
    case "/m/u/p": {
      return m_gp(req, user, me);
    }
    case "/m/u/g": {
      return m_sg(req, user, me);
    }
    case "/m/o/p": {
      return m_pc(user);
    }
    case "/m/o/c": {
      return m_cp(req, user, me);
    }
    case "/m/m/s": {
      return m_gs(user);
    }
    case "/m/o/s": {
      return await m_ss(req, user);
    }
    case "/m/o/t": {
      return m_st(req, user, session, me, au);
    }
    case "/m/m/a": {
      if (gameConfig.version < 37) return new Response("404");
      const id = req.headers.get("id");
      
      if (!id) return new Response("");
      
      if (id == "0") {
        return new Response((await Deno.readTextFile("./assets/ads.txt")).split("\n").join(';'));
      }
      
      serverConsoleLog(`sending ads/${id}.png`);
      
      if (id.includes("..")) return new Response("");

      try {
        await Deno.lstat(`./assets/ads/${id}.png`)
      } catch (err) {
        if (!(err instanceof Deno.errors.NotFound)) {
          throw err;
        }
        
        return new Response("0");
      }
      
      return new Response(await Deno.readFile(`./assets/ads/${id}.png`), {
        status: 200,
        headers: {
          "content-type": "image/png; charset=binary",
        },
      });
    }
    case "/m/m/i": {
      return await m_im(user, me);
    }
    case "/m/m/t": {
      return await m_tv(user, me, req.headers.get("ty") ?? '');
    }
  }
}