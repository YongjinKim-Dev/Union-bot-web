# ashi_bot.py 연동 가이드

투표 UI(버튼)는 이 웹앱(`/vote`)으로 이전되었습니다. `ashi_bot.py`는 더 이상
`get_survey_view()` 버튼을 붙일 필요가 없고, 설문 15분 전에 투표 페이지
링크만 채널에 전송하면 됩니다. `survey.status`(wait → process → complete)
값은 그대로 유지되며, 웹앱은 `status = 'process'`인 설문을 활성 설문으로
간주합니다.

`user`, `guild`, `survey`, `survey_history`, `character_class`,
`user_character_class_map` 테이블은 스키마 변경 없이 그대로 사용합니다.

## 1. `check_sendable_survey` — 15분 전 링크 전송

기존에는 `exposed_at` 도달 시 버튼이 달린 메시지를 보냈습니다. 아래처럼
15분 전 시점에 링크만 보내도록 조건과 전송 내용을 바꿉니다.

```python
WEB_VOTE_URL = os.getenv("WEB_VOTE_URL")  # 예: https://vote.example.com/vote

@tasks.loop(seconds=30)
async def check_sendable_survey():
    db = get_db()
    cursor = db.cursor()
    try:
        cursor.execute(
            "SELECT id, content FROM survey "
            "WHERE status = 'wait' AND exposed_at < DATE_ADD(NOW(), INTERVAL 9 HOUR + INTERVAL 15 MINUTE)"
        )
        result = cursor.fetchone()
        if result:
            await send_nodewar_survey_link(result[0], result[1])
    except:
        pass
    finally:
        cursor.close()
        db.close()


async def send_nodewar_survey_link(survey_id, survey_message):
    survey_channel = bot.get_channel(int(survey_channel_id))
    message = await survey_channel.send(
        content=f"{survey_message}\n\n👉 아래 링크에서 투표해주세요.\n{WEB_VOTE_URL}"
    )

    db = get_db()
    cursor = db.cursor()
    try:
        cursor.execute(
            "UPDATE survey SET status = 'process', updated_at = NOW(), discord_message_id = %s WHERE id = %s",
            (message.id, survey_id),
        )
        db.commit()
    except:
        await message.delete()
    finally:
        cursor.close()
        db.close()
```

`survey.discord_message_id`는 이제 버튼 컴포넌트를 가진 메시지를 가리키지
않으므로, `!결과` / `!인원제한결과`처럼 `discord_message_id`로 설문을 찾는
명령어들의 `message_id` 인자는 그대로 두거나, 원한다면 `survey.id`를 직접
받도록 바꿔도 됩니다(두 컬럼 다 남아있으니 필수는 아닙니다).

## 2. `close_survey` — 버튼 제거 로직 삭제

웹앱이 `executed_at - 1시간` 기준으로 투표 마감을 직접 판단하므로
(`getVotingClosesAt`, [format.ts](../src/lib/format.ts)), 디스코드 메시지의
`view`를 편집할 필요가 없습니다. `status`를 `complete`로 바꾸는 부분만
남기고 `message.edit(view=...)` 호출은 제거합니다.

```python
@tasks.loop(minutes=1)
async def close_survey():
    db = get_db()
    cursor = db.cursor()
    try:
        cursor.execute(
            "SELECT id FROM survey WHERE status = 'process' "
            "AND DATE_SUB(executed_at, INTERVAL 1 HOUR) <= DATE_ADD(NOW(), INTERVAL 9 HOUR)"
        )
        for (sid,) in cursor.fetchall():
            cursor.execute("UPDATE survey SET status = 'complete' WHERE id = %s", (sid,))
        db.commit()
    except:
        pass
    finally:
        cursor.close()
        db.close()
```

## 3. 제거 가능한 코드

버튼/셀렉트 UI로 투표를 처리하던 아래 항목들은 웹앱이 대체하므로
`ashi_bot.py`에서 삭제해도 됩니다: `get_survey_view`, `SurveyButton`,
`SurveyConfirmButton`, `ClassTypeSelectBox`, `ClassNameSelectBox`,
`ClassChangeButton`, `get_class_change_view`, `get_insert_class_view`,
`get_update_class_view`, `start_class_change` 커맨드. 운영진용 조회/관리
명령어(`!결과`, `!인원제한결과`, `!회원등록`, `!탈퇴` 등)는 그대로 두면
됩니다.

## 4. 환경변수

봇 `.env`에 `WEB_VOTE_URL`을 추가하세요. 웹앱과 봇은 같은 MySQL
(`DB_HOST`/`DB_USER`/`DB_PASSWORD`/`DB_NAME`)을 그대로 공유합니다 —
웹앱의 [.env.example](../.env.example) 참고.
