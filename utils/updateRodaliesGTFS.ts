import fs from 'fs/promises'
import path from 'path'
import https from 'https'
import { createWriteStream, createReadStream } from 'fs'
import unzipper from 'unzipper'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const GTFS_URL = 'https://ssl.renfe.com/ftransit/Fichero_CER_FOMENTO/fomento_transit.zip'
const TARGET_DIR = path.resolve(__dirname, '../../public/data/rodalies/gtfs')
const TMP_ZIP_PATH = path.resolve(__dirname, '../../public/data/rodalies/temp_gtfs.zip')

/**
 * Downloads a file from a URL to a specified path
 */
async function downloadFile(url: string, targetPath: string): Promise<void> {
  console.log(`Downloading GTFS data from ${url}...`)

  return new Promise((resolve, reject) => {
    const file = createWriteStream(targetPath)

    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download file: ${response.statusCode} ${response.statusMessage}`))
        return
      }

      response.pipe(file)

      file.on('finish', () => {
        file.close()
        console.log(`Download completed: ${targetPath}`)
        resolve()
      })
    }).on('error', (err) => {
      fs.unlink(targetPath).catch(console.error)
      reject(err)
    })
  })
}

/**
 * Extracts a ZIP file to a specified directory
 */
async function extractZip(zipPath: string, targetDir: string): Promise<void> {
  console.log(`Extracting ${zipPath} to ${targetDir}...`)

  await fs.mkdir(targetDir, { recursive: true })

  await createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: targetDir }))
    .promise()

  console.log('Extraction completed successfully')
}

/**
 * Updates the GTFS data by downloading and extracting the latest version
 */
export async function updateRodaliesGTFS(): Promise<void> {
  try {
    await fs.mkdir(path.dirname(TMP_ZIP_PATH), { recursive: true })
    await downloadFile(GTFS_URL, TMP_ZIP_PATH)

    try {
      await fs.rm(TARGET_DIR, { recursive: true, force: true })
      console.log(`Cleared existing GTFS directory: ${TARGET_DIR}`)
    } catch (err) {
      // If it doesn't exist, it's okay
    }

    await fs.mkdir(TARGET_DIR, { recursive: true })
    await extractZip(TMP_ZIP_PATH, TARGET_DIR)
    await fs.unlink(TMP_ZIP_PATH).catch(console.error)

    console.log('GTFS data update completed successfully')
  } catch (err) {
    console.error('Error updating GTFS data:', err)
    throw err
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  updateRodaliesGTFS()
    .then(() => console.log('GTFS update process completed'))
    .catch(err => {
      console.error('GTFS update failed:', err)
      process.exit(1)
    })
}
