import { mkdir, writeFile } from "node:fs/promises";
import type { CapabilityArtifact } from "./types.js";

export async function saveArtifact(
    artifact: CapabilityArtifact,
    filePath: string,
): Promise<void> {
    await mkdir("artifacts", {
        recursive: true,
    });

    const json = JSON.stringify(artifact, null, 2);

    await writeFile(filePath, `${json}\n`, "utf8");
}