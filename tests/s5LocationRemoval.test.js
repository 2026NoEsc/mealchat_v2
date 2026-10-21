const fs = require('node:fs');
const path = require('node:path');
it('ships without the unused location module or requested location permissions',()=>{
 const config=require('../app.json').expo,packages=require('../package.json');
 expect(config.plugins.map(plugin=>Array.isArray(plugin)?plugin[0]:plugin)).not.toContain('expo-location');
 expect(config.ios.infoPlist).not.toHaveProperty('NSLocationWhenInUseUsageDescription');
 expect(config.android.permissions.join(' ')).not.toMatch(/ACCESS_(FINE|COARSE)_LOCATION/);
 expect(config.android.blockedPermissions).toEqual(expect.arrayContaining(['android.permission.ACCESS_FINE_LOCATION','android.permission.ACCESS_COARSE_LOCATION']));
 expect(packages.dependencies).not.toHaveProperty('expo-location');
 const walk=directory=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(directory,entry.name)):/\.[jt]sx?$/.test(entry.name)?[path.join(directory,entry.name)]:[]);
 for(const file of walk(path.resolve(__dirname,'../src')))expect(fs.readFileSync(file,'utf8')).not.toMatch(/(?:from\s*|require\(\s*|import\(\s*)['"]expo-location['"]/);
});
