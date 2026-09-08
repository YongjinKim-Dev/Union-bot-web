import type { RowDataPacket } from "mysql2/promise";
import { pool } from "@/lib/db";

/*
 * 스펙조사 저장 구조.
 *
 * 세팅과 제출을 나눈다. spec_build 는 연맹원이 평소에 만지는 세팅이라 언제든
 * 고치고 지운다. spec_submission 은 조사에 낸 스펙이라 낸 순간의 값을 통째로
 * 복사해 굳힌다. 제출이 세팅을 참조만 하면, 나중에 그 세팅을 고쳤을 때 이미
 * 낸 스펙까지 조용히 따라 바뀐다. 투표에서 survey_history 와
 * survey_history_final 을 나눈 것과 같은 이유다.
 *
 * 장비·수정·광명석은 한 세트다. 장비만 바꾸고 수정이 그대로 남으면 그건 세팅이
 * 아니다. 셋을 같은 행에 둔다.
 *
 * 기존 테이블이 Django 가 만든 것이라 외래키가 걸려 있지만, 우리가 새로 만드는
 * 테이블은 survey_history_final · vote_failure_log 와 같이 외래키 없이 둔다.
 * 봇과 웹이 같은 DB 를 쓰는 상황에서 제약이 늘면 한쪽의 실수가 다른 쪽을
 * 멈추게 한다.
 */
export async function ensureSpecTables(): Promise<void> {
  // 연맹원이 만드는 세팅. 개수 상한(8)은 parseWorkspace 가 이미 들고 있어
  // 앱에서 막는다. MySQL 로는 "사용자당 몇 개" 를 제약으로 쓸 수 없다.
  await pool.execute(
    "CREATE TABLE IF NOT EXISTS spec_build (" +
      "id bigint NOT NULL AUTO_INCREMENT, " +
      "user_id bigint NOT NULL, " +
      "name varchar(40) NOT NULL, " +
      "gear json NOT NULL, " +
      "crystals json NOT NULL, " +
      "lightstones json NOT NULL, " +
      "ap smallint NOT NULL, " +
      "aap smallint NOT NULL, " +
      "dp smallint NOT NULL, " +
      "score smallint NOT NULL, " +
      "is_complete tinyint(1) NOT NULL, " +
      "created_at datetime(6) NOT NULL, " +
      "updated_at datetime(6) NOT NULL, " +
      "PRIMARY KEY (id), " +
      // 같은 이름의 세팅이 둘 있으면 고르는 화면에서 구별할 수가 없다.
      "UNIQUE KEY uq_build_user_name (user_id, name), " +
      "KEY idx_build_user (user_id))",
  );

  // 조사 회차. closed_at 이 NULL 이면 상시 접수다.
  await pool.execute(
    "CREATE TABLE IF NOT EXISTS spec_survey (" +
      "id bigint NOT NULL AUTO_INCREMENT, " +
      "title varchar(60) NOT NULL, " +
      "opened_at datetime(6) NOT NULL, " +
      "closed_at datetime(6) NULL, " +
      "created_at datetime(6) NOT NULL, " +
      "updated_at datetime(6) NOT NULL, " +
      "PRIMARY KEY (id), " +
      "KEY idx_spec_survey_opened (opened_at))",
  );

  /*
   * 제출. gear·crystals·lightstones 는 spec_build 에서 복사해온 값이고,
   * summary_text 는 그때 사람이 읽던 형태다.
   *
   * 텍스트까지 굳히는 이유는 아이템 id 가 가모스 원본 id 를 그대로 쓰기
   * 때문이다(garmoth-930601). 카탈로그를 다시 뽑아 id 가 바뀌거나 빠지면
   * 저장된 JSON 이 어떤 장비였는지 알 수 없게 된다. 텍스트는 그때 무엇을
   * 냈는지를 카탈로그와 무관하게 남긴다.
   */
  await pool.execute(
    "CREATE TABLE IF NOT EXISTS spec_submission (" +
      "id bigint NOT NULL AUTO_INCREMENT, " +
      "spec_survey_id bigint NOT NULL, " +
      "user_id bigint NOT NULL, " +
      // 어느 세팅에서 냈는지. 그 세팅이 지워지면 NULL 로 남는다.
      "source_build_id bigint NULL, " +
      "build_name varchar(40) NOT NULL, " +
      "gear json NOT NULL, " +
      "crystals json NOT NULL, " +
      "lightstones json NOT NULL, " +
      "ap smallint NOT NULL, " +
      "aap smallint NOT NULL, " +
      "dp smallint NOT NULL, " +
      "score smallint NOT NULL, " +
      "is_complete tinyint(1) NOT NULL, " +
      "summary_text text NOT NULL, " +
      "created_at datetime(6) NOT NULL, " +
      "updated_at datetime(6) NOT NULL, " +
      "PRIMARY KEY (id), " +
      // 한 회차에 한 사람 한 번. 다시 내면 갱신한다. survey_history 는 이
      // 제약이 없어서 나중에 중복을 지우고 붙여야 했다.
      "UNIQUE KEY uq_submission_survey_user (spec_survey_id, user_id), " +
      // 관리자 명단은 공방합 내림차순이 기본이다.
      "KEY idx_submission_rank (spec_survey_id, score DESC), " +
      "KEY idx_submission_user (user_id))",
  );

  // 회차를 나누기 전까지는 상시 접수 한 줄로 받는다. 나중에 회차제로 갈 때
  // 행만 추가하면 되므로 스키마를 다시 바꿀 일이 없다.
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT EXISTS(SELECT 1 FROM spec_survey) AS filled",
  );
  if (Number(rows[0].filled) === 1) return;
  await pool.execute(
    "INSERT INTO spec_survey (title, opened_at, closed_at, created_at, updated_at) " +
      "VALUES ('상시 스펙조사', NOW(6), NULL, NOW(6), NOW(6))",
  );
}
