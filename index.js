/**
 * RuiZhang  skyperson@gmail.com
 */

'use strict';

const path = require('path');
const fs = require('fs');
const VirtualModulesPlugin = require('webpack-virtual-modules');

const SingleEntryPlugin = require("webpack/lib/SingleEntryPlugin");

const utils = require('./lib/utils');

class entryWrapperWebpackPlugin {

    constructor(options = {}){
        this.options = Object.assign({
            skipExistFiles: false,
            include: /.*/,
            exclude : null,
            template: '',
            file: '',
            ext : 'js'
        }, options);
    }

    apply(compiler){

        const wrapperEntry = [];
        const context = compiler.context;
        const _opt = this.options;
        const virtualModules = new VirtualModulesPlugin({

        });
        virtualModules.apply(compiler);
        function writeEntriesFiles(){
            const compileTemplate = (originPath,name) => {
                const params = { origin: originPath ,name};
                const contentIsFunction = typeof templateContents === 'function';
                return contentIsFunction
                    ? templateContents(params)
                    : utils.compileTemplate(templateContents, params);
            };

            function saveToVirtualFilesystem(jsPath, contents){
                const modulePath = path.isAbsolute(jsPath) ? jsPath : path.join(context, jsPath);
                if(fs.existsSync(modulePath) && _opt.skipExistFiles) return;
                virtualModules.writeModule(modulePath, contents);
            }

            wrapperEntry.forEach(({source, wrapper,name}) => {
                saveToVirtualFilesystem(wrapper, compileTemplate(source,name))
            });
        }
        if(_opt.file){
            const filename = _opt.file;
            const filePath = path.isAbsolute(filename) ? filename : path.resolve(context, filename);
            this.contents = fs.readFileSync(filePath, { encoding: 'utf8' });
        } else if ((typeof _opt.template).match(/string|function/)){
            this.contents = _opt.template;
        } else {
            const filePath = path.join(__dirname, 'default_index.js');
            this.contents = fs.readFileSync(filePath, { encoding: 'utf8' });
        }

        const templateContents = this.contents;

        compiler.hooks.entryOption.tap('EntryWrapper', function(context, entry) {

            const extToJs = npath => utils.replaceExt(npath, '.__wrapper__.' + _opt.ext);

            function action(n,name){
                if(_opt.exclude){
                    const excludes = _opt.exclude instanceof Array ? _opt.exclude : [_opt.exclude];
                    const len = excludes.length;
                    for(let i = 0; i < len; ++i){
                        const reg = excludes[i];
                        if(reg.test(n)){
                            return n;
                        }
                    }
                }
                if(_opt.include.test(n)){
                    const _js = extToJs(n);
                    wrapperEntry.push({
                        source: n,
                        wrapper: _js,
                        name,
                    });
                    return _js;
                }
                return n;
            }

            function itemToPlugin({import : item}, name) {
                if(Array.isArray(item)){
                    return item.map((i) => {
                        return new SingleEntryPlugin(context, action(i,name), name);
                    })
                } else {
                    return [new SingleEntryPlugin(context, action(item,name), name)];
                }
            }

            if(typeof entry === "string" || Array.isArray(entry)) {
                itemToPlugin(entry, "main").forEach((t) => {
                    t.apply(compiler);
                })
            } else if(typeof entry === "object") {
                Object.keys(entry).forEach(function(name) {
                    itemToPlugin(entry[name], name).forEach((t) => {
                        t.apply(compiler)
                    })
                });
            }
            writeEntriesFiles();
            return true;

        });
    }

}

module.exports = entryWrapperWebpackPlugin;

