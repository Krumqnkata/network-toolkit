package io.github.krumqnkata.networktoolkit.storage

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

data class StoredRecord(val id: Long, val kind: String, val createdAt: Long, val data: String)

/**
 * The app's SQLite database (Android's built-in SQLite, no extra library).
 *
 * - `records`: JSON documents (speed-test results, monitor sessions, reports)
 *   by kind and time. The JSON is validated with Zod when read in TypeScript,
 *   so its shape can evolve without schema migrations.
 * - `settings`: key/value preferences.
 *
 * Schema changes are appended to [MIGRATIONS] and never edited afterwards.
 */
class AppDatabase(context: Context) :
    SQLiteOpenHelper(context.applicationContext, NAME, null, MIGRATIONS.size) {

    override fun onCreate(db: SQLiteDatabase) = migrate(db, 0, MIGRATIONS.size)

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) =
        migrate(db, oldVersion, newVersion)

    private fun migrate(db: SQLiteDatabase, from: Int, to: Int) {
        for (version in from until to) MIGRATIONS[version].forEach(db::execSQL)
    }

    fun insert(kind: String, createdAt: Long, data: String): Long {
        val values = ContentValues().apply {
            put("kind", kind)
            put("created_at", createdAt)
            put("data", data)
        }
        return writableDatabase.insertOrThrow("records", null, values)
    }

    /** Newest first; `before` (exclusive, ms) pages through older records. */
    fun list(kind: String, limit: Int, before: Long?): List<StoredRecord> {
        val args = mutableListOf(kind)
        var where = "kind = ?"
        if (before != null) {
            where += " AND created_at < ?"
            args += before.toString()
        }
        readableDatabase.query(
            "records",
            arrayOf("id", "kind", "created_at", "data"),
            where,
            args.toTypedArray(),
            null,
            null,
            "created_at DESC, id DESC",
            limit.toString(),
        ).use { cursor ->
            val result = ArrayList<StoredRecord>(cursor.count)
            while (cursor.moveToNext()) {
                result += StoredRecord(cursor.getLong(0), cursor.getString(1), cursor.getLong(2), cursor.getString(3))
            }
            return result
        }
    }

    fun update(id: Long, data: String): Boolean {
        val values = ContentValues().apply { put("data", data) }
        return writableDatabase.update("records", values, "id = ?", arrayOf(id.toString())) > 0
    }

    fun delete(id: Long): Boolean =
        writableDatabase.delete("records", "id = ?", arrayOf(id.toString())) > 0

    fun clear(kind: String): Int = writableDatabase.delete("records", "kind = ?", arrayOf(kind))

    /** Keeps the newest `keep` records of a kind. */
    fun prune(kind: String, keep: Int): Int = writableDatabase.delete(
        "records",
        "kind = ? AND id NOT IN (SELECT id FROM records WHERE kind = ? ORDER BY created_at DESC, id DESC LIMIT ?)",
        arrayOf(kind, kind, keep.toString()),
    )

    fun getSetting(key: String): String? =
        readableDatabase.query("settings", arrayOf("value"), "key = ?", arrayOf(key), null, null, null).use {
            if (it.moveToFirst()) it.getString(0) else null
        }

    fun setSetting(key: String, value: String?) {
        if (value == null) {
            writableDatabase.delete("settings", "key = ?", arrayOf(key))
            return
        }
        val values = ContentValues().apply {
            put("key", key)
            put("value", value)
        }
        writableDatabase.insertWithOnConflict("settings", null, values, SQLiteDatabase.CONFLICT_REPLACE)
    }

    companion object {
        const val NAME = "network-toolkit.db"

        /** Index i upgrades the schema from version i to i + 1. */
        val MIGRATIONS: List<List<String>> = listOf(
            listOf(
                """
                CREATE TABLE records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    kind TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    data TEXT NOT NULL
                )
                """.trimIndent(),
                "CREATE INDEX records_kind_created ON records (kind, created_at DESC)",
                "CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)",
            ),
        )
    }
}
