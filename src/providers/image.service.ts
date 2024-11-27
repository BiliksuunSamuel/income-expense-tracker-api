import { Injectable, Logger } from '@nestjs/common';
import * as cloudinary from 'cloudinary';
import { cloudinaryConfiguration } from 'src/cloudinary.config';
import { FileInfo } from 'src/common/file.info.dto';

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);

  constructor() {}

  //upload image
  async cloudinaryUpload(
    file: any,
    folder: string = 'ElectionResultsPinkSheets',
  ): Promise<FileInfo> {
    try {
      const res: any = await cloudinary.v2.uploader.upload(file, {
        ...cloudinaryConfiguration,
        folder,
      });
      return res;
    } catch (error) {
      this.logger.error(
        error,
        'an error occured while uploading file to cloudinary',
      );
      return null;
    }
  }

  async deleteCloudinaryImage(info: { id: string; url: string }) {
    return new Promise((resolve, reject) => {
      try {
        cloudinary.v2.uploader.destroy(info.id, async (error, res) => {
          await Promise.resolve();
          error && reject(error);
          resolve(res);
        });
      } catch (error) {
        reject(error);
      }
    });
  }
}
