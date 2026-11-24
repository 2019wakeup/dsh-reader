import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { replaceFile, writeFileAtomic } from '../lib/atomic-write.js'

async function tempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'reader-atomic-'))
}

test('writeFileAtomic replaces the destination', async () => {
  const dir = await tempDir()
  try {
    const file = path.join(dir, 'store.json')
    await fs.writeFile(file, 'old')
    await writeFileAtomic(file, 'new')
    assert.equal(await fs.readFile(file, 'utf8'), 'new')
    const leftovers = (await fs.readdir(dir)).filter((name) => name.includes('.tmp-'))
    assert.deepEqual(leftovers, [])
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('replaceFile retries a transient rename lock', async () => {
  const dir = await tempDir()
  const file = path.join(dir, 'store.json')
  const tmp = path.join(dir, 'store.tmp')
  try {
    await fs.writeFile(file, 'old')
    await fs.writeFile(tmp, 'new')
    const original = fs.rename
    let calls = 0
    fs.rename = async (from, to) => {
      calls += 1
      if (calls < 3) {
        const error = new Error('locked')
        error.code = 'EBUSY'
        throw error
      }
      return original.call(fs, from, to)
    }
    try {
      await replaceFile(tmp, file)
    } finally {
      fs.rename = original
    }
    assert.equal(calls, 3)
    assert.equal(await fs.readFile(file, 'utf8'), 'new')
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('replaceFile falls back to copying when rename never succeeds', async () => {
  const dir = await tempDir()
  const file = path.join(dir, 'store.json')
  const tmp = path.join(dir, 'store.tmp')
  try {
    await fs.writeFile(file, 'old')
    await fs.writeFile(tmp, 'new')
    const original = fs.rename
    fs.rename = async () => {
      const error = new Error('locked')
      error.code = 'EPERM'
      throw error
    }
    try {
      await replaceFile(tmp, file)
    } finally {
      fs.rename = original
    }
    assert.equal(await fs.readFile(file, 'utf8'), 'new')
    await assert.rejects(fs.stat(tmp))
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})
