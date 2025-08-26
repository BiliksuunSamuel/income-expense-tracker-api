export class FileContentResponse {
  content: string;
  fileName: string;
  contentType: string;

  constructor(content: string, fileName: string, contentType: string) {
    this.content = content;
    this.fileName = fileName;
    this.contentType = contentType;
  }
}
