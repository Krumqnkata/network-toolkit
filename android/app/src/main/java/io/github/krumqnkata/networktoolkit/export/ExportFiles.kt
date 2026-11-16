package io.github.krumqnkata.networktoolkit.export

/** Rules for files the app writes for sharing: safe names, known types, bounded size. */
object ExportFiles {
    const val MAX_BYTES = 10 * 1024 * 1024
    const val DIRECTORY = "exports"

    /** Allowed extensions and the MIME type each one is shared as. */
    val TYPES = mapOf(
        "png" to "image/png",
        "svg" to "image/svg+xml",
        "txt" to "text/plain",
        "json" to "application/json",
    )

    /** Keeps letters, digits, dot, dash and underscore; requires a known extension. */
    fun safeName(fileName: String): String {
        val cleaned = fileName.trim().replace(Regex("[^A-Za-z0-9._-]"), "_").trimStart('.')
        require(cleaned.isNotEmpty() && cleaned.length <= 100) { "Invalid file name" }
        val extension = cleaned.substringAfterLast('.', "").lowercase()
        require(extension in TYPES) { "Unsupported file type: $extension" }
        return cleaned
    }

    fun mimeType(fileName: String): String = TYPES.getValue(fileName.substringAfterLast('.').lowercase())
}
