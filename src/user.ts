import { Row } from "https://raw.githubusercontent.com/dyedgreen/deno-sqlite/refs/heads/master/mod.ts";
import { db, getGhost, getPlayer } from "./db.ts";
import { now, serverLog, shortenName } from "./utils.ts";
import { lastMessageFrom } from "./speak.ts";
import { gameConfig } from "./config.ts";
import { canBeFloat } from "./utils.ts";
import { sharedEvents } from "./shared.ts";
import { EventType } from "./event_emitter.ts";

export const sessions:MexpSession[] = [];

export class MexpSession {
    username:string = "_edit";
    inactivityTimer:number = 0;
    mapChangeTimer:number = 0;

    legitBallpitAlt:boolean = false;

    constructor() {
        this.resetTimer();
    }

    public resetTimer() {
        if (this.inactivityTimer) clearTimeout(this.inactivityTimer);

        this.inactivityTimer = setTimeout(() => {
            const index = sessions.indexOf(this);
            if (index > -1) sessions.splice(index, 1);
            
            sharedEvents.emit(EventType.SessionDisconnected, this);
            if (gameConfig.version < 25) {
                serverLog(`there is no activity.`);
            } else {
                serverLog(`see you soon, ${shortenName(this.username)}.`);
            }
        }, 1000 * 60);
    }

    public clearMapTimer() {
        if (this.mapChangeTimer) clearTimeout(this.mapChangeTimer);
    }
    
    public doMapTimer(finalMap:string) {
        this.clearMapTimer();

        this.mapChangeTimer = setTimeout(() => {
            const user = this.getUser();
            if (!user) return;
            user.lastSpawnData = `${finalMap} 0 0.9 0 0`;
            user.commit();
        }, 1000 * 60 * 4);
    }

    destroy() {
        clearTimeout(this.inactivityTimer);
        clearTimeout(this.mapChangeTimer);
    }

    public getUser(): MexpUser|null {
        return getPlayer(this.username, true, true);
    }
}

export class MexpPosition {
    x:number = 0;
    y:number = 0.9;
    z:number = 0;
    r:number = 0;

    static testString(str: string): boolean {
        const split = str.split(" ");
        if (split.length != 4) return false;
        return canBeFloat(split[0]) && canBeFloat(split[1]) && canBeFloat(split[2]) && canBeFloat(split[3]);
    }

    static fromString(str: string): MexpPosition {
        const pos:MexpPosition = new MexpPosition();
        const split = str.split(" ");

        if (split.length != 4) return pos;

        pos.x = Number.parseFloat(split[0]);
        pos.y = Number.parseFloat(split[1]);
        pos.z = Number.parseFloat(split[2]);
        pos.r = Number.parseFloat(split[3]);
        return pos
    }

    static fromRow(row: Row): MexpPosition {
        const pos:MexpPosition = new MexpPosition();

        pos.x = row[3] as number;
        pos.y = row[4] as number;
        pos.z = row[5] as number;
        pos.r = row[6] as number;
        return pos
    }

    public str(): string {
        return `${this.x} ${this.y} ${this.z} ${this.r}`;
    }
}

export enum GhostType {
    Classic,     // normal red eyes
    Authorized,  // _edit eye
    Upgrade,     // green eye
    Inactive,    // gray eyes
    Gone,        // transparent gray eyes (version 37 and above only)
    It           // _worker/fuck[user] eye (version 29 and above only)
}

export class MexpGhost {
    name:string = "";
    type:GhostType = GhostType.Classic;
    scene:string = "map_welcome";
    position:MexpPosition = new MexpPosition;
    speak:string = "";

    static fromRow(row: Row, lastPlayed: number = -1): MexpGhost {
        const ghost:MexpGhost = new MexpGhost();

        ghost.name = row[0] as string;
        ghost.type = MexpGhost.strToType(row[1] as string);
        ghost.scene = row[2] as string;
        ghost.position = MexpPosition.fromString(row[3] as string);
        ghost.speak = lastMessageFrom(name);
        
        ghost.doTypeCheck(lastPlayed);

        return ghost;
    }

    static fromUser(user: string): MexpGhost|null {
        const player:MexpUser|null = getPlayer(user, true, false);
        if (!player) return null;
        return getGhost(player);
    }

    private static strToType(type:string): GhostType {
        switch (type) {
            case "Classic": return GhostType.Classic;
            case "Authorized": return GhostType.Authorized;
            case "Upgrade": return GhostType.Upgrade;
            case "Inactive": return GhostType.Inactive;
            case "Gone": return GhostType.Gone;
            case "It": return GhostType.It;
            default: return GhostType.Classic;
        }
    }

    private static typeToStr(type:GhostType): string {
        switch (type) {
            case GhostType.Classic: return "Classic";
            case GhostType.Authorized: return "Authorized";
            case GhostType.Upgrade: return "Upgrade";
            case GhostType.Inactive: return "Inactive";
            case GhostType.Gone: return "Gone";
            case GhostType.It: return "It";
        }
    }

    public doTypeCheck(lastPlayed:number) {
        if (this.type == GhostType.Classic && lastPlayed != -1)
        {
            if (now() - lastPlayed >= 1209600 /* 2 weeks */) {
                if (now() - lastPlayed >= 21038400 /* 8 months */ && gameConfig.version >= 37) {
                    this.type = GhostType.Gone;
                } else {
                    this.type = GhostType.Inactive;
                }
            }
        }

        if (this.type == GhostType.It && gameConfig.version < 29) this.type = GhostType.Classic;
    }

    public str(): string {
        if (gameConfig.version <= 19) {
            return `${this.position.str()} ${this.type == GhostType.Authorized ? "1" : "0"} ${this.name} ${this.speak}`;
        } else {
            return `${this.position.str()} ${MexpGhost.typeToStr(this.type)} ${this.name} ${this.speak}`;
        }
    }

    public commit() {
        if (this.existsOnDB()) {
            this.updateOnDB();
        } else {
            this.createOnDB();
        }
    }

    public existsOnDB() {
        const stmt = db.prepareQuery("SELECT * FROM ghosts WHERE username = ?");
        const rows = stmt.all([this.name]);
        stmt.finalize();
        return rows.length > 0;
    }

    private updateOnDB() {
        const stmt = db.prepareQuery("UPDATE ghosts SET ghostType = ?, scene = ?, pos = ? WHERE username = ?");
        stmt.execute([
            MexpGhost.typeToStr(this.type),
            this.scene,
            this.position.str(),
            this.name
        ]);
        stmt.finalize();
    }

    private createOnDB() {
        const stmt = db.prepareQuery("INSERT INTO ghosts (username, ghostType, scene, pos) VALUES (?, ?, ?, ?)");
        stmt.execute([
            this.name,
            MexpGhost.typeToStr(this.type),
            this.scene,
            this.position.str()
        ]);
        stmt.finalize();
    }
}

export class MexpUser {
    username:string = "_edit";
    pass:string = "or";
    banned:boolean = false;
    lastSpawnData:string = "map_welcome 0 0.9 0 0";
    legitTokens:string = "";
    cheatTokens:string = "";
    lastPlayed:number = 0;
    
    ghost: MexpGhost = new MexpGhost;

    public commit() {
        if (this.existsOnDB()) {
            this.updateOnDB();
        } else {
            this.createOnDB();
        }
    }

    public existsOnDB() {
        const stmt = db.prepareQuery("SELECT * FROM users WHERE username = ?");
        const rows = stmt.all([this.username]);
        stmt.finalize();
        return rows.length > 0;
    }

    private updateOnDB() {
        const stmt = db.prepareQuery("UPDATE users SET banned = ?, lastSpawnData = ?, legitTokens = ?, cheatTokens = ?, lastPlayed = ? WHERE username = ? AND pass = ?");
        stmt.execute([
            this.banned,
            this.lastSpawnData,
            this.legitTokens,
            this.cheatTokens,
            this.lastPlayed,
            this.username,
            this.pass
        ]);
        stmt.finalize();
    }

    private createOnDB() {
        const stmt = db.prepareQuery("INSERT INTO users (username, pass, banned, lastSpawnData, legitTokens, cheatTokens, lastPlayed) VALUES (?, ?, ?, ?, ?, ?, ?)");
        stmt.execute([
            this.username,
            this.pass,
            this.banned,
            this.lastSpawnData,
            this.legitTokens,
            this.cheatTokens,
            this.lastPlayed
        ]);
        stmt.finalize();

        this.ghost.commit();
    }

    static fromRow(row: Row, getGhost:boolean): MexpUser {
        const user:MexpUser = new MexpUser();

        user.username = row[0] as string;
        user.pass = row[1] as string;
        user.banned = row[2] as boolean;
        user.lastSpawnData = row[3] as string;
        user.legitTokens = row[4] as string;
        user.cheatTokens = row[5] as string;
        user.lastPlayed = row[6] as number;

        if (getGhost) {
            const ghost:MexpGhost|null = MexpGhost.fromUser(user.username);
            if (ghost) user.ghost = ghost;
        }
        return user;
    }
}

export const hasSession = (me:string): boolean => sessions.some(session => session.username === me);
export const getSession = (me:string): MexpSession|null => sessions.find(session => session.username === me) ?? null;