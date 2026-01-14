// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add onnx to asset extensions so we can require() the model file
config.resolver.assetExts.push('onnx');
config.resolver.assetExts.push('zip');

module.exports = config;
