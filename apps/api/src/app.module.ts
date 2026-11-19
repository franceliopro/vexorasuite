import { Module } from '@nestjs/common';
import { SitesDeployModule } from './modules/sites-deploy/sites-deploy.module';
import { SiteEditorModule } from './modules/site-editor/site-editor.module';

@Module({
  imports: [
    SitesDeployModule,
    SiteEditorModule,
  ],
})
export class AppModule {}