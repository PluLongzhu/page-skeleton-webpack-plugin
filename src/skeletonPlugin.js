'use strict'

const merge = require('lodash/merge')
const webpack = require('webpack')
const optionsSchema = require('./config/optionsSchema.json')
const Server = require('./server')
const { addScriptTag, insertSkeletonScreen, snakeToCamel } = require('./util')
const { defaultOptions, staticPath } = require('./config/config')
const OptionsValidationError = require('./config/optionsValidationError')

const EVENT_LIST = process.env.NODE_ENV === 'production' ? ['watch-close', 'failed', 'done'] : ['watch-close', 'failed']
const PLUGIN_NAME = 'pageSkeletonWebpackPlugin'

function SkeletonPlugin(options = {}) {
  const validationErrors = webpack.validateSchema(optionsSchema, options)
  if (validationErrors.length) {
    throw new OptionsValidationError(validationErrors)
  }
  this.options = merge({ staticPath }, defaultOptions, options)
  this.server = null
}

SkeletonPlugin.prototype.createServer = function () { // eslint-disable-line func-names
  if (!this.server) {
    const server = this.server = new Server(this.options) // eslint-disable-line no-multi-assign
    server.listen().catch(err => server.log.warn(err))
  }
}

SkeletonPlugin.prototype.insertScriptToClient = function (htmlPluginData, callback) { // eslint-disable-line func-names
  // at develop phase, insert the interface code
  if (process.env.NODE_ENV !== 'production') {
    const { port } = this.options
    const clientEntry = `http://localhost:${port}/${staticPath}/index.bundle.js`
    const oldHtml = htmlPluginData.html
    htmlPluginData.html = addScriptTag(oldHtml, clientEntry, port)
  }
  insertSkeletonScreen(htmlPluginData, this.options).then(html => {
    htmlPluginData.html = html
    callback(null, htmlPluginData)
  })

}

SkeletonPlugin.prototype.apply = function (compiler) { // eslint-disable-line func-names
  if (compiler.hooks) {
    compiler.hooks.entryOption.tap(PLUGIN_NAME, () => {
      this.createServer()
    })

    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
      compilation.hooks.htmlWebpackPluginBeforeHtmlProcessing.tapAsync(PLUGIN_NAME, (htmlPluginData, callback) => {
        this.insertScriptToClient(htmlPluginData, callback)
      })

    })

    EVENT_LIST.forEach((event) => {
      compiler.hooks[snakeToCamel(event)].tap(PLUGIN_NAME, () => {
        if (this.server) {
          this.server.close()
        }
      })
    })
  } else {
    compiler.plugin('entry-option', () => {
      this.createServer()
    })

    compiler.plugin('compilation', (compilation) => {
      compilation.plugin('html-webpack-plugin-before-html-processing', (htmlPluginData, callback) => {
        this.insertScriptToClient(htmlPluginData, callback)
      })
    })

    EVENT_LIST.forEach((event) => {
      compiler.plugin(event, () => {
        if (this.server) {
          this.server.close()
        }
      })
    })
  }
}

module.exports = SkeletonPlugin
