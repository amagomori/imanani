import { Community, Program } from "./Manageable";
import { ProgramBuilder, CommunityBuilder } from "./CheckableBuilder";

class BucketClient {
    private rev: number;
    private readonly token: string;

    constructor(revision: number, token: string) {
        this.rev = revision;
        this.token = token;
    }

    revision(): number {
        return this.rev;
    }

    setRevision(revision: number, token: string) {
        if (token == this.token) {
            this.rev = revision;
        }
    }
}

export class Bucket {
    private communities: Community[];
    private revision: number;
    private readonly token: string;

    constructor() {
        this.communities = new Array<Community>();
        this.revision = 0;
        this.token = "@@NICOSAPO";
    }

    touch(communityBuilder: CommunityBuilder) {
        this.touchCommunity(communityBuilder);
    }

    assign(communityBuilder: CommunityBuilder, programBuilder: ProgramBuilder) {
        this.touchBoth(communityBuilder, programBuilder, this.revision);
    }

    appoint(communityBuilder: CommunityBuilder, programBuilder: ProgramBuilder) {
        this.touchBoth(communityBuilder, programBuilder, -1);
    }

    mask(communityBuilders: CommunityBuilder[]) {
        const communities = communityBuilders.map(builder => this.touchCommunity(builder));
        const survivors = communities.map(c => c.id);
        this.communities = this.communities.filter(c => {
            return survivors.includes(c.id) ||
            c.shouldOpenAutomatically ||
            c.programs.some(p => p.shouldOpenAutomatically)
        });
        this.revision += 1;
    }

    createClient():  BucketClient {
        return new BucketClient(0, this.token);
    }

    private touchCommunity(communityBuilder: CommunityBuilder): Community {
        const community = this.createCommunity(communityBuilder);
        // Replace.
        this.communities = this.communities.filter(c => c.id != community.id);
        this.communities.push(community);
        return community;
    }

    private touchBoth(communityBuilder: CommunityBuilder, programBuilder: ProgramBuilder, revision: number) {
        const community = this.touchCommunity(communityBuilder);
        const program = this.createProgram(programBuilder, community, revision);
        // Attach.
        community.attachProgram(program);
        program.community = community;
    }

    takeProgramsShouldCancelOpen(client: BucketClient): Program[] {
        const result =  this.communities
          .map(c => c.programs)
          .reduce((array, v) => array.concat(v), [])
          .filter(p => p.isVisiting)
          .filter(p =>
            p.shouldOpenAutomatically || p.community.shouldOpenAutomatically
          )
          .filter(p => p.revision() != -1 && p.revision() >= client.revision());
        client.setRevision(this.revision, this.token);
        return result;
    }

    takeProgramsShouldOpen(client: BucketClient): Program[] {
        const result =  this.communities
            .map(c => c.programs)
            .reduce((array, v) => array.concat(v), [])
            .filter(p => !p.isVisiting)
            .filter(p =>
                p.shouldOpenAutomatically || p.community.shouldOpenAutomatically
            )
            .filter(p => p.revision() != -1 && p.revision() >= client.revision());
        client.setRevision(this.revision, this.token);
        return result;
    }

    programs(): Program[] {
        return this.communities
            .map(c => c.programs)
            .reduce((array, v) => array.concat(v), [])
    }

    private createCommunity(builder: CommunityBuilder): Community {
        const draft = builder.build();
        const reference = this.findCommunity(draft, this.communities) || draft;
        // Update.
        builder.thumbnailUrl(builder.getThumbnailUrl() || reference.thumbnailUrl);
        builder.isFollowing(builder.getIsFollowing() || reference.isFollowing);
        const flag = builder.getShouldOpenAutomatically();
        if (flag != null) {
            builder.shouldOpenAutomatically(flag);
        } else {
            builder.shouldOpenAutomatically(reference.shouldOpenAutomatically)
        }
        // Build.
        const community = builder.build();
        // Attach previous programs.
        reference.programs.forEach(p => {
            community.attachProgram(p);
            p.community = community;
        });
        return community;
    }

    private createProgram(builder: ProgramBuilder, parent: Community, revision: number): Program {
        const draft = builder.build(revision);
        const reference = this.findProgram(draft, parent) || draft;
        // Update.
        builder.isVisiting(builder.getIsVisiting() || reference.isVisiting);
        const shouldOpen = builder.getShouldOpenAutomatically();
        if (shouldOpen != null) {
            builder.shouldOpenAutomatically(shouldOpen);
        } else {
            builder.shouldOpenAutomatically(reference.shouldOpenAutomatically)
        }
        const shouldMove = builder.getShouldMoveAutomatically();
        if (shouldMove != null) {
            builder.shouldMoveAutomatically(shouldMove);
        } else {
            builder.shouldMoveAutomatically(reference.shouldMoveAutomatically)
        }
        // Build.
        return builder.build(Math.max(revision, reference.revision()));
    }

    private findCommunity(community: Community, communities: Community[]): Community | null {
        const ids = communities.map(c => c.id).filter(id => id == community.id);
        if (ids.length == 0) {
            return null;
        }
        const id = ids[0];
        return communities.filter(c => c.id == id)[0];
    }

    private findProgram(program: Program, parent: Community): Program | null {
        return parent.programs.filter(p => p.id == program.id)[0];
    }
}
