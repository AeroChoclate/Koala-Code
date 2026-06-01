export class QdrantIndexer {
  public async indexCodebase(workspacePath: string): Promise<void> {
    console.log(`Indexing ${workspacePath} with Qdrant...`);
  }
}
