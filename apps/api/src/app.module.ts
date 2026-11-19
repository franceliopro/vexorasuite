import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SitesDeployModule } from './modules/sites-deploy/sites-deploy.module';
import { SiteEditorModule } from './modules/site-editor/site-editor.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SitesDeployModule,
    SiteEditorModule,
  ],
})
export class AppModule {}