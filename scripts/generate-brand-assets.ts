#!/usr/bin/env tsx

import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, isAbsolute, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import process from 'node:process'

type BuildOptions = {
  appDir: string
  background: string
  brandName: string
  iconsDir: string
  logoOutput: string | null
  logoSize: number
  socialOutputDir: string | null
  source: string
  textColor: string
}

type SizeSpec = {
  file: string
  size: number
}

const ICON_SIZES: SizeSpec[] = [
  { file: 'favicon-16x16.png', size: 16 },
  { file: 'favicon-32x32.png', size: 32 },
  { file: 'favicon-48x48.png', size: 48 },
  { file: 'favicon-96x96.png', size: 96 },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'apple-touch-icon-57x57.png', size: 57 },
  { file: 'apple-touch-icon-60x60.png', size: 60 },
  { file: 'apple-touch-icon-72x72.png', size: 72 },
  { file: 'apple-touch-icon-76x76.png', size: 76 },
  { file: 'apple-touch-icon-114x114.png', size: 114 },
  { file: 'apple-touch-icon-120x120.png', size: 120 },
  { file: 'apple-touch-icon-144x144.png', size: 144 },
  { file: 'apple-touch-icon-152x152.png', size: 152 },
  { file: 'apple-touch-icon-180x180.png', size: 180 },
  { file: 'android-icon-36x36.png', size: 36 },
  { file: 'android-icon-48x48.png', size: 48 },
  { file: 'android-icon-72x72.png', size: 72 },
  { file: 'android-icon-96x96.png', size: 96 },
  { file: 'android-icon-144x144.png', size: 144 },
  { file: 'android-icon-192x192.png', size: 192 },
  { file: 'ms-icon-70x70.png', size: 70 },
  { file: 'ms-icon-144x144.png', size: 144 },
  { file: 'ms-icon-150x150.png', size: 150 },
  { file: 'ms-icon-310x310.png', size: 310 },
  { file: 'icon-192x192.png', size: 192 },
  { file: 'icon-384x384.png', size: 384 },
  { file: 'icon-512x512.png', size: 512 },
]

const options = parseArgs(process.argv.slice(2))
const appDir = resolvePath(options.appDir ?? process.cwd())
const publicDir = resolve(appDir, 'public')
const buildOptions: BuildOptions = {
  appDir,
  background: options.background ?? '#111113',
  brandName: options.brandName ?? inferBrandName(appDir),
  iconsDir: resolvePath(options.iconsDir ?? resolve(publicDir, 'icons')),
  logoOutput: options.logoOutput ? resolvePath(options.logoOutput) : null,
  logoSize: Number.parseInt(options.logoSize ?? '1024', 10),
  socialOutputDir: options.socialOutputDir ? resolvePath(options.socialOutputDir) : null,
  source: resolvePath(options.source ?? resolve(publicDir, 'logo.png')),
  textColor: options.textColor ?? '#ffffff',
}

main(buildOptions)

function main(options: BuildOptions) {
  assertExists(options.source)
  ensureDir(options.iconsDir)

  const tempDir = mkdtempSync(resolve(tmpdir(), 'hominem-brand-assets-'))

  try {
    for (const spec of ICON_SIZES) {
      resizeSquare(options.source, resolve(options.iconsDir, spec.file), spec.size)
    }

    createFavicon(options.source, resolve(options.iconsDir, 'favicon.ico'))
    createSocialPreview(options, tempDir, resolve(options.iconsDir, 'og-image.jpg'))
    copyFileSync(resolve(options.iconsDir, 'og-image.jpg'), resolve(options.iconsDir, 'twitter-card.jpg'))
    if (options.socialOutputDir) {
      ensureDir(options.socialOutputDir)
      copyFileSync(resolve(options.iconsDir, 'og-image.jpg'), resolve(options.socialOutputDir, 'og-image.jpg'))
      copyFileSync(
        resolve(options.iconsDir, 'twitter-card.jpg'),
        resolve(options.socialOutputDir, 'twitter-card.jpg'),
      )
    }
    if (options.logoOutput) {
      resizeSquare(options.source, options.logoOutput, options.logoSize)
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

function resizeSquare(source: string, output: string, size: number) {
  run('magick', [
    source,
    '-background',
    'none',
    '-alpha',
    'set',
    '-filter',
    'Lanczos',
    '-resize',
    `${size}x${size}^`,
    '-gravity',
    'center',
    '-extent',
    `${size}x${size}`,
    '-strip',
    output,
  ])
}

function createFavicon(source: string, output: string) {
  run('magick', [
    source,
    '-background',
    'none',
    '-alpha',
    'set',
    '-filter',
    'Lanczos',
    '-define',
    'icon:auto-resize=16,32,48,64,128,256',
    '-strip',
    output,
  ])
}

function createSocialPreview(options: BuildOptions, tempDir: string, output: string) {
  const logo = resolve(tempDir, 'logo.png')
  const font = detectFont([
    'Helvetica Neue:style=Bold',
    'Helvetica:style=Bold',
    'Arial:style=Bold',
  ])

  run('magick', [
    options.source,
    '-background',
    'none',
    '-alpha',
    'set',
    '-filter',
    'Lanczos',
    '-resize',
    '420x420^',
    '-gravity',
    'center',
    '-extent',
    '420x420',
    '-strip',
    logo,
  ])

  run('magick', [
    '-size',
    '1200x630',
    `canvas:${options.background}`,
    logo,
    '-gravity',
    'center',
    '-geometry',
    '+0-62',
    '-composite',
    '-font',
    font,
    '-fill',
    options.textColor,
    '-pointsize',
    '96',
    '-gravity',
    'center',
    '-annotate',
    '+0+228',
    options.brandName,
    '-strip',
    output,
  ])
}

function detectFont(families: string[]) {
  for (const family of families) {
    const result = spawnSync('fc-match', ['-f', '%{file}\\n', family], { encoding: 'utf8' })
    const file = result.stdout.trim()
    if (result.status === 0 && file) {
      return file
    }
  }

  throw new Error(`Unable to resolve a font for: ${families.join(', ')}`)
}

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { encoding: 'utf8' })

  if (result.status === 0) {
    return
  }

  const stderr = result.stderr.trim()
  const stdout = result.stdout.trim()
  const details = [stdout, stderr].filter(Boolean).join('\n')
  throw new Error(`Command failed: ${command} ${args.join(' ')}${details ? `\n${details}` : ''}`)
}

function ensureDir(path: string) {
  mkdirSync(path, { recursive: true })
}

function assertExists(path: string) {
  if (!existsSync(path)) {
    throw new Error(`Missing source file: ${path}`)
  }
}

function inferBrandName(appDir: string) {
  return titleCase(basename(appDir))
}

function parseArgs(argv: string[]) {
  const parsed: Record<string, string> = {}

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    if (!current.startsWith('--')) {
      continue
    }

    const [flag, inlineValue] = current.slice(2).split('=', 2)
    const value = inlineValue ?? argv[index + 1]
    if (value && !value.startsWith('--')) {
      parsed[toCamelCase(flag)] = value
      if (!inlineValue) {
        index += 1
      }
    }
  }

  return parsed
}

function resolvePath(value: string) {
  return isAbsolute(value) ? value : resolve(process.cwd(), value)
}

function toCamelCase(value: string) {
  return value.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
}

function titleCase(value: string) {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(' ')
}
