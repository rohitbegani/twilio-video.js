import * as assert from 'assert';
import VideoDriver from '../../../src/videodriver';
import ParticipantDriver from '../../../src/videodriver/participant';
import RoomDriver from '../../../src/videodriver/room';
const defaults = require('../../../../lib/defaults');
const getToken = require('../../../../lib/token');
const { combinationContext, randomName } = require('../../../../lib/util');

const { REALM, VERSION } = process.env;
const realm: string = REALM || 'prod';
const version: string = VERSION || '1.6.1';

describe('RoomDriver', function() {
  this.timeout(60000);

  describe('#disconnect', () => {
    ['chrome', 'firefox'].forEach(browser => {
      context(browser, () => {
        let roomDriver: RoomDriver;
        let videoDriver: VideoDriver;

        before(async () => {
          const name: string = randomName();
          videoDriver = new VideoDriver({ browser, realm, version });
          roomDriver = await videoDriver.connect(getToken(browser), { ...defaults, name });
        });

        it('should disconnect from the Room in the browser', async () => {
          roomDriver.disconnect();
          const disconnectedRoomDriver: RoomDriver = await new Promise(resolve => {
            roomDriver.once('disconnected', resolve);
          });
          assert(disconnectedRoomDriver, roomDriver);
          assert(roomDriver.state, 'disconnected');
        });

        after(() => {
          videoDriver.close();
        });
      });
    });
  });

  describe('#getStats', () => {
    ['chrome', 'firefox'].forEach(browser => {
      context(browser, () => {
        let name: string;
        let roomDrivers: Array<RoomDriver>;
        let stats: Array<any>;
        let videoDriver: VideoDriver;

        before(async () => {
          const constraints: Array<any> = [{ audio: true }, { video: true }];
          const tokens: Array<string> = [randomName(), randomName()].map(getToken);

          name = randomName();
          videoDriver = new VideoDriver({ browser, realm, version });

          roomDrivers = await(Promise.all(tokens.map((token, i) => {
            return videoDriver.connect(token, {
              ...defaults,
              ...constraints[i],
              name
            });
          })));

          // Wait for a second for WebRTC stats to be generated.
          await new Promise(resolve => setTimeout(resolve, 1000));

          stats = await Promise.all(roomDrivers.map(roomDriver => roomDriver.getStats()));
        });

        it('should resolve with WebRTC stats for the appropriate Tracks for the first Participant', () => {
          const { localParticipant: { audioTracks } } = roomDrivers[0];
          const { localParticipant: { videoTracks } } = roomDrivers[1];
          const [{
            localAudioTrackStats,
            localVideoTrackStats,
            remoteAudioTrackStats,
            remoteVideoTrackStats
          }] = stats[0];

          assert.equal(localAudioTrackStats.length, 1);
          assert.equal(localAudioTrackStats[0].trackId, audioTracks[0].id);
          assert.equal(localVideoTrackStats.length, 0);

          assert.equal(remoteAudioTrackStats.length, 0);
          assert.equal(remoteVideoTrackStats.length, 1);
          assert.equal(remoteVideoTrackStats[0].trackId, videoTracks[0].id);
        });

        it('should resolve with WebRTC stats for the appropriate Tracks for the second Participant', () => {
          const { localParticipant: { audioTracks } } = roomDrivers[0];
          const { localParticipant: { videoTracks } } = roomDrivers[1];
          const [{
            localAudioTrackStats,
            localVideoTrackStats,
            remoteAudioTrackStats,
            remoteVideoTrackStats
          }] = stats[1];

          assert.equal(localAudioTrackStats.length, 0);
          assert.equal(localVideoTrackStats.length, 1);
          assert.equal(localVideoTrackStats[0].trackId, videoTracks[0].id);

          assert.equal(remoteAudioTrackStats.length, 1);
          assert.equal(remoteAudioTrackStats[0].trackId, audioTracks[0].id);
          assert.equal(remoteVideoTrackStats.length, 0);
        });

        after(() => {
          roomDrivers.forEach(roomDriver => roomDriver.disconnect());
          videoDriver.close();
        });
      });
    });
  });

  describe('events', () => {
    combinationContext([
      [
        ['participantConnected', 'participantDisconnected'],
        x => `"${x}"`
      ],
      [
        ['chrome', 'firefox'],
        x => `when the first Participant is in ${x}`
      ],
      [
        ['chrome', 'firefox'],
        x => `when the second Participant is in ${x}`
      ]
    ], ([ event, ...browsers ]) => {
      let participantDriver: ParticipantDriver;
      let roomDrivers: Array<RoomDriver>;
      let videoDrivers: Array<VideoDriver>;

      before(async () => {
        const identities: Array<string> = browsers.map((browser, i) => `${browser}${i}`);
        const name: string = randomName();
        const tokens: Array<string> = identities.map(getToken);

        roomDrivers = [];
        videoDrivers = browsers.map(browser => new VideoDriver({ browser, realm, version }));
        roomDrivers.push(await videoDrivers[0].connect(tokens[0], { ...defaults, name }));

        const participantEvent: Promise<ParticipantDriver> = new Promise(resolve => {
          roomDrivers[0].once(event, resolve);
        });

        roomDrivers.push(await videoDrivers[1].connect(tokens[1], { ...defaults, name }));
        if (event === 'participantDisconnected') {
          roomDrivers[1].disconnect();
        }
        participantDriver = await participantEvent;
      });

      it(`should emit "${event}" on the first Participant with a ParticipantDriver for the second Participant`, () => {
        assert(participantDriver instanceof ParticipantDriver);
        assert.equal(participantDriver.identity, roomDrivers[1].localParticipant.identity);
        assert.equal(participantDriver.sid, roomDrivers[1].localParticipant.sid);

        assert(event === 'participantConnected'
          ? roomDrivers[0].participants.has(participantDriver.sid)
          : !roomDrivers[0].participants.has(participantDriver.sid));
      });

      after(() => {
        roomDrivers.forEach(roomDriver => roomDriver.disconnect());
        videoDrivers.forEach(videoDriver => videoDriver.close());
      });
    });

    combinationContext([
      [
        ['trackAdded', 'trackSubscribed'],
        x => `"${x}"`
      ],
      [
        ['chrome', 'firefox'],
        x => `when the first Participant is in ${x}`
      ],
      [
        ['chrome', 'firefox'],
        x => `when the second Participant is in ${x}`
      ]
    ], ([ event, ...browsers ]) => {
      let roomDrivers: Array<RoomDriver>;
      let tracksAndParticipants: Array<[any, ParticipantDriver]>;
      let videoDrivers: Array<VideoDriver>;

      before(async () => {
        const identities: Array<string> = browsers.map((browser, i) => `${browser}${i}`);
        const name: string = randomName();
        const tokens: Array<string> = identities.map(getToken);

        roomDrivers = [];
        videoDrivers = browsers.map(browser => new VideoDriver({ browser, realm, version }));
        roomDrivers.push(await videoDrivers[0].connect(tokens[0], { ...defaults, name }));

        const trackEvents: Promise<Array<[any, ParticipantDriver]>> = new Promise(resolve => {
          roomDrivers[0].on(event, (track: any, participantDriver: ParticipantDriver) => {
            if (participantDriver.tracks.size === 2) {
              resolve(Array.from(participantDriver.tracks.values()).map((track: any) => [track, participantDriver]));
            }
          });
        });

        roomDrivers.push(await videoDrivers[1].connect(tokens[1], { ...defaults, name }));
        tracksAndParticipants = await trackEvents;
      });

      it(`should emit "${event}" events on the first Participant with serialized RemoteTracks and ParticipantDriver for`
         + ` the second Participant`, () => {
        const { localParticipant: { identity, sid, trackPublications, tracks } } = roomDrivers[1];
        assert.equal(tracksAndParticipants.length, 2);

        tracksAndParticipants.forEach(([ serializedRemoteTrack, participantDriver ]) => {
          const track: any = tracks.find(track => serializedRemoteTrack.id === track.id);
          const publication: string = trackPublications.find(publication => track.id === publication.track.id);

          ['id, kind', 'name'].forEach(prop => assert.equal(serializedRemoteTrack[prop], track[prop]));
          assert.equal(serializedRemoteTrack.sid, publication.trackSid);

          assert(participantDriver instanceof ParticipantDriver);
          assert.equal(participantDriver.identity, identity);
          assert.equal(participantDriver.sid, sid);
          assert(participantDriver.tracks.has(serializedRemoteTrack.id));
          assert(participantDriver[`${serializedRemoteTrack.kind}Tracks`].has(serializedRemoteTrack.id));
        });
      });

      after(() => {
        roomDrivers.forEach(roomDriver => roomDriver.disconnect());
        videoDrivers.forEach(videoDriver => videoDriver.close());
      });
    });
  });
});