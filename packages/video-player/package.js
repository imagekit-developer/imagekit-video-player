import * as ngPackagrImport from 'ng-packagr';
import * as fs from 'fs';

ngPackagrImport.ngPackagr()
  .forProject('ng-package.json')
  .withTsConfig('tsconfig.angular.json')
  .build()
  .then(() => {
    console.log('Build completed successfully');

    fs.unlinkSync('./dist/angular/package.json');
    fs.unlinkSync('./dist/angular/.npmignore');
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
