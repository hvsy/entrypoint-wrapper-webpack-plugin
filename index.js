/**
 * RuiZhang  skyperson@gmail.com
 */

'use strict';

const path = require('path');
const fs = require('fs');

const SingleEntryPlugin = require("webpack/lib/SingleEntryPlugin");
const MultiEntryPlugin = require("webpack/lib/MultiEntryPlugin");

const utils = require('./lib/utils');
const virtualFilesystem = require('./lib/virtual-file-system');

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
                    const excludes = typeof _opt.exclude === 'array' ? _opt.exclude : [_opt.exclude];
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

            function itemToPlugin(item, name) {
                if(Array.isArray(item)){
                    item = item.map((i)=>action(i,name));
                    return new MultiEntryPlugin(context, item, name);
                } else {
                    return new SingleEntryPlugin(context, action(item,name), name);
                }
            }

            if(typeof entry === "string" || Array.isArray(entry)) {
                // compiler.apply(itemToPlugin(entry, "main"));
                itemToPlugin(entry, "main").apply(compiler);
            } else if(typeof entry === "object") {
                Object.keys(entry).forEach(function(name) {
                    // compiler.apply(itemToPlugin(entry[name], name));
                    itemToPlugin(entry[name], name).apply(compiler)
                });
            }

            return true;

        });

        compiler.hooks.thisCompilation.tap("EntryWrapper", function(compilation) {

            const inputFileSystem = compilation.inputFileSystem;

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
                virtualFilesystem({
                    fs: inputFileSystem,
                    modulePath,
                    contents
                });
            }

            wrapperEntry.forEach(({source, wrapper,name}) => {
                saveToVirtualFilesystem(wrapper, compileTemplate(source,name))
            });

        });

    }

}

module.exports = entryWrapperWebpackPlugin;
