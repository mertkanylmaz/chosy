// @ts-check
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

/**
 * GLB / GLTF 3D model asset desteği.
 * FlickMascot bileşeni assets/flick/flick-3d.glb yükler.
 */
config.resolver.assetExts.push('glb', 'gltf', 'bin');

module.exports = config;
